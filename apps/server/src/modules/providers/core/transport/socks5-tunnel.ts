import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import type { ProviderProxyConfig } from './proxy-types';

export interface Socks5ConnectOptions {
  proxyHost: string;
  proxyPort: number;
  targetHost: string;
  targetPort: number;
  auth?: {
    username?: string;
    password?: string;
  };
  timeoutMs?: number;
}

const SOCKS5_ERROR_CODES: Record<number, string> = {
  1: 'General SOCKS server failure',
  2: 'Connection not allowed by ruleset',
  3: 'Network unreachable',
  4: 'Host unreachable',
  5: 'Connection refused',
  6: 'TTL expired',
  7: 'Command not supported',
  8: 'Address type not supported',
};

/**
 * Establishes a raw TCP connection through an RFC 1928 SOCKS5 proxy server.
 */
export function createSocks5Connection(options: Socks5ConnectOptions): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeoutMs ?? 10_000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cleanedUp = false;

    const cleanup = () => {
      cleanedUp = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const socket = net.connect({
      host: options.proxyHost,
      port: options.proxyPort,
    });

    timer = setTimeout(() => {
      if (!cleanedUp) {
        cleanup();
        socket.destroy(
          new Error(`SOCKS5 connection to ${options.proxyHost}:${options.proxyPort} timed out after ${timeout}ms`),
        );
      }
    }, timeout);

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });

    socket.once('connect', () => {
      // Step 1: Send client greeting with supported authentication methods
      const hasAuth = Boolean(options.auth?.username || options.auth?.password);
      const methods = hasAuth ? [0x00, 0x02] : [0x00]; // 0x00 = NO_AUTH, 0x02 = USER_PASS
      const greeting = Buffer.from([0x05, methods.length, ...methods]);

      socket.write(greeting);

      socket.once('data', (authChoiceChunk) => {
        if (authChoiceChunk.length < 2 || authChoiceChunk[0] !== 0x05) {
          cleanup();
          socket.destroy();
          return reject(new Error('Invalid SOCKS5 proxy server greeting response'));
        }

        const selectedMethod = authChoiceChunk[1];

        if (selectedMethod === 0xff) {
          cleanup();
          socket.destroy();
          return reject(new Error('SOCKS5 proxy rejected authentication methods (No acceptable methods)'));
        }

        // Step 2: Handle Username/Password Authentication (RFC 1929)
        if (selectedMethod === 0x02) {
          const user = Buffer.from(options.auth?.username || '', 'utf8');
          const pass = Buffer.from(options.auth?.password || '', 'utf8');

          if (user.length > 255 || pass.length > 255) {
            cleanup();
            socket.destroy();
            return reject(new Error('SOCKS5 username or password exceeds 255 bytes'));
          }

          const authBuf = Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]);

          socket.write(authBuf);

          socket.once('data', (authResultChunk) => {
            if (authResultChunk.length < 2 || authResultChunk[0] !== 0x01 || authResultChunk[1] !== 0x00) {
              cleanup();
              socket.destroy();
              return reject(new Error('SOCKS5 authentication failed: invalid username or password'));
            }
            sendConnectRequest();
          });
        } else if (selectedMethod === 0x00) {
          // No authentication required
          sendConnectRequest();
        } else {
          cleanup();
          socket.destroy();
          return reject(new Error(`Unsupported SOCKS5 auth method selected: ${selectedMethod}`));
        }
      });
    });

    // Step 3: Send SOCKS5 CONNECT Request
    function sendConnectRequest() {
      const isIp = net.isIP(options.targetHost);
      let atyp: number;
      let addrBuf: Buffer;

      if (isIp === 4) {
        atyp = 0x01; // IPv4
        addrBuf = Buffer.from(options.targetHost.split('.').map(Number));
      } else {
        atyp = 0x03; // Domain Name (SOCKS5h remote DNS)
        const hostBuf = Buffer.from(options.targetHost, 'utf8');
        addrBuf = Buffer.concat([Buffer.from([hostBuf.length]), hostBuf]);
      }

      const portBuf = Buffer.allocUnsafe(2);
      portBuf.writeUInt16BE(options.targetPort, 0);

      const connectReq = Buffer.concat([Buffer.from([0x05, 0x01, 0x00, atyp]), addrBuf, portBuf]);

      socket.write(connectReq);

      socket.once('data', (connectResChunk: Buffer | string) => {
        cleanup();
        const buf = Buffer.isBuffer(connectResChunk) ? connectResChunk : Buffer.from(connectResChunk);
        if (buf.length < 4 || buf[0] !== 0x05) {
          socket.destroy();
          return reject(new Error('Invalid SOCKS5 CONNECT response from proxy'));
        }

        const rep = buf[1];
        if (rep !== 0x00) {
          const errMsg = SOCKS5_ERROR_CODES[rep] || `SOCKS5 error code 0x${rep.toString(16)}`;
          socket.destroy();
          return reject(new Error(`SOCKS5 CONNECT failed: ${errMsg}`));
        }

        // Successfully connected! Return raw stream socket
        resolve(socket);
      });
    }
  });
}

/**
 * Creates a drop-in fetch function that tunnels all HTTP/HTTPS requests over a SOCKS5 proxy.
 */
export function createSocks5Fetch(proxyConfig: ProviderProxyConfig): typeof globalThis.fetch {
  const proxiedFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(rawUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const targetPort = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : isHttps ? 443 : 80;
    const targetHost = parsedUrl.hostname;

    // Check for AbortSignal before connecting
    if (init?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    // Step 1: Connect to target via SOCKS5 proxy
    const rawSocket = await createSocks5Connection({
      proxyHost: proxyConfig.host,
      proxyPort: proxyConfig.port,
      targetHost,
      targetPort,
      auth: proxyConfig.auth,
      timeoutMs: proxyConfig.timeoutMs,
    });

    // Step 2: Encapsulate with TLS if HTTPS
    let transportSocket: net.Socket | tls.TLSSocket = rawSocket;

    if (isHttps) {
      transportSocket = await new Promise<tls.TLSSocket>((resolveTls, rejectTls) => {
        const tlsSocket = tls.connect({
          socket: rawSocket,
          servername: proxyConfig.tls?.servername || targetHost,
          rejectUnauthorized: proxyConfig.tls?.rejectUnauthorized !== false,
          ca: proxyConfig.tls?.ca,
          cert: proxyConfig.tls?.cert,
          key: proxyConfig.tls?.key,
        });

        tlsSocket.once('secureConnect', () => resolveTls(tlsSocket));
        tlsSocket.once('error', (err) => {
          rawSocket.destroy();
          rejectTls(err);
        });
      });
    }

    // Step 3: Execute HTTP request over the socket
    return new Promise<Response>((resolveFetch, rejectFetch) => {
      const method = (init?.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {
        Host: parsedUrl.host,
        Connection: 'close',
      };

      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headers[k] = v;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) {
            headers[k] = v;
          }
        } else {
          Object.assign(headers, init.headers);
        }
      }

      const client = isHttps ? https : http;
      const req = client.request(
        {
          hostname: targetHost,
          port: targetPort,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method,
          headers,
          createConnection: () => transportSocket,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const bodyBuffer = Buffer.concat(chunks);
            const responseHeaders = new Headers();
            for (const [k, v] of Object.entries(res.headers)) {
              if (v !== undefined) {
                if (Array.isArray(v)) {
                  for (const val of v) responseHeaders.append(k, val);
                } else {
                  responseHeaders.set(k, v);
                }
              }
            }

            const response = new Response(bodyBuffer, {
              status: res.statusCode || 200,
              statusText: res.statusMessage || 'OK',
              headers: responseHeaders,
            });

            resolveFetch(response);
          });
        },
      );

      if (init?.signal) {
        const onAbort = () => {
          req.destroy(new DOMException('The operation was aborted', 'AbortError'));
          transportSocket.destroy();
          rejectFetch(new DOMException('The operation was aborted', 'AbortError'));
        };
        init.signal.addEventListener('abort', onAbort, { once: true });
      }

      req.on('error', (err) => {
        transportSocket.destroy();
        rejectFetch(err);
      });

      if (init?.body) {
        if (typeof init.body === 'string' || Buffer.isBuffer(init.body)) {
          req.write(init.body);
        } else {
          req.write(String(init.body));
        }
      }

      req.end();
    });
  };

  return proxiedFetch as unknown as typeof globalThis.fetch;
}
