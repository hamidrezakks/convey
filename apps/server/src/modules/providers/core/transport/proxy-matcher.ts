import type { ProviderProxyConfig, ProxyType } from './proxy-types';

/**
 * Parses an IPv4 address string to a 32-bit integer for fast bitwise CIDR matching.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Checks if an IP address falls within an IPv4 CIDR range (e.g. 10.0.0.0/8).
 */
function ipInCidr(ip: string, cidr: string): boolean {
  const [range, prefixStr] = cidr.split('/');
  if (!range || !prefixStr) return false;
  const prefix = Number.parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Determines whether a target URL should bypass the configured proxy based on noProxy rules.
 */
export function isProxyBypassed(targetUrl: string, noProxyList?: string[]): boolean {
  if (!noProxyList || noProxyList.length === 0) {
    return false;
  }

  let hostname: string;
  try {
    const parsed = new URL(targetUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    // If not a full URL, treat as raw host
    hostname = targetUrl.toLowerCase().split(':')[0];
  }

  for (const rule of noProxyList) {
    const trimmed = rule.trim().toLowerCase();
    if (!trimmed) continue;

    // 1. Wildcard match all
    if (trimmed === '*') return true;

    // 2. Exact match (e.g. "localhost", "127.0.0.1", "internal.api.company.com")
    if (hostname === trimmed) return true;

    // 3. Subdomain / suffix match (e.g. "*.corp.net" or ".corp.net" or "corp.net")
    if (trimmed.startsWith('*.')) {
      const suffix = trimmed.slice(2);
      if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
        return true;
      }
    } else if (trimmed.startsWith('.')) {
      const suffix = trimmed.slice(1);
      if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
        return true;
      }
    } else if (hostname.endsWith(`.${trimmed}`)) {
      return true;
    }

    // 4. IPv4 CIDR matching (e.g. "10.0.0.0/8", "192.168.0.0/16")
    if (trimmed.includes('/')) {
      if (ipInCidr(hostname, trimmed)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Parses a single-string proxy URL into structured ProviderProxyConfig components.
 */
export function parseProxyUrl(rawUrl: string): Partial<ProviderProxyConfig> {
  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol.toLowerCase();
    let type: ProxyType = 'http';
    if (protocol.startsWith('socks5')) {
      type = 'socks5';
    } else if (protocol.startsWith('https')) {
      type = 'https';
    } else {
      type = 'http';
    }

    const host = parsed.hostname;
    const defaultPort = type === 'socks5' ? 1080 : type === 'https' ? 8443 : 8080;
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;

    const config: Partial<ProviderProxyConfig> = {
      type,
      host,
      port,
      protocol: parsed.protocol as ProviderProxyConfig['protocol'],
      rawUrl,
    };

    if (parsed.username || parsed.password) {
      config.auth = {
        username: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
      };
    }

    return config;
  } catch {
    return {};
  }
}

/**
 * Formats a normalized proxy URL from config, with optional credential inclusion or masking.
 */
export function formatProxyUrl(config: ProviderProxyConfig, maskSecrets = false): string {
  if (config.rawUrl && !maskSecrets) {
    return config.rawUrl;
  }

  const scheme = config.protocol ? config.protocol.replace(/:$/, '') : config.type;
  let authPart = '';

  if (config.auth?.username) {
    const user = encodeURIComponent(config.auth.username);
    const pass = config.auth.password ? `:${maskSecrets ? '***' : encodeURIComponent(config.auth.password)}` : '';
    authPart = `${user}${pass}@`;
  }

  return `${scheme}://${authPart}${config.host}:${config.port}`;
}

/**
 * Deeply masks sensitive credentials inside ProviderProxyConfig before returning to API clients or logs.
 */
export function maskProxyConfig(config?: ProviderProxyConfig): ProviderProxyConfig | undefined {
  if (!config) return undefined;

  const masked: ProviderProxyConfig = {
    ...config,
    auth: config.auth
      ? {
          username: config.auth.username,
          password: config.auth.password ? '***' : undefined,
        }
      : undefined,
  };

  if (masked.rawUrl) {
    try {
      const u = new URL(masked.rawUrl);
      if (u.password) {
        u.password = '***';
        masked.rawUrl = u.toString();
      }
    } catch {
      // ignore
    }
  }

  return masked;
}
