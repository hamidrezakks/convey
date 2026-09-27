import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const) {
  blockedV6.addSubnet(address, prefix, 'ipv6');
}

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}

export function validateWebhookUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) {
    throw new Error('Webhook destinations must use HTTPS on port 443 without credentials or fragments');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicWebhookAddress(host)) throw new Error('Webhook destination must be a public address');
  return url;
}

export async function resolveWebhookDestination(raw: string, resolver = lookup) {
  const url = validateWebhookUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicWebhookAddress(address))) {
    throw new Error('Webhook destination DNS must resolve exclusively to public addresses');
  }
  return { url, hostname, address: addresses[0].address };
}

/** Connect to the validated IP directly. DNS cannot change between validation and connection.
 * TLS still authenticates the original hostname. Redirect responses are never followed.
 */
export async function postCustomerWebhook(raw: string, headers: Record<string, string>, body: string): Promise<number> {
  const signal = AbortSignal.timeout(10_000);
  const destination = await Promise.race([
    resolveWebhookDestination(raw),
    new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(new Error('Webhook DNS timeout')), { once: true }),
    ),
  ]);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        protocol: 'https:',
        hostname: destination.address,
        port: 443,
        servername: isIP(destination.hostname) ? undefined : destination.hostname,
        path: `${destination.url.pathname}${destination.url.search}`,
        method: 'POST',
        headers: { ...headers, Host: destination.url.host, 'Content-Length': Buffer.byteLength(body).toString() },
        agent: false,
        signal,
      },
      (res) => {
        resolve(res.statusCode || 502);
        res.destroy(); // Webhook response bodies are not needed; never buffer unbounded input.
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}
