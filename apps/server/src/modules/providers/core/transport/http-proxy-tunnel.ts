import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { formatProxyUrl } from './proxy-matcher';
import type { ProviderProxyConfig } from './proxy-types';

export interface HttpProxyConnectOptions {
  proxyHost: string;
  proxyPort: number;
  isProxyTls?: boolean;
  targetHost: string;
  targetPort: number;
  auth?: {
    username?: string;
    password?: string;
  };
  headers?: Record<string, string>;
  tlsOptions?: ProviderProxyConfig['tls'];
  timeoutMs?: number;
}

/**
 * Establishes an HTTP CONNECT tunnel socket through an HTTP or HTTPS forward proxy.
 */
export function createHttpConnectTunnel(options: HttpProxyConnectOptions): Promise<net.Socket> {
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

    const onConnect = (rawSocket: net.Socket) => {
      const connectHeaders: string[] = [
        `CONNECT ${options.targetHost}:${options.targetPort} HTTP/1.1`,
        `Host: ${options.targetHost}:${options.targetPort}`,
        'Proxy-Connection: Keep-Alive',
      ];

      if (options.auth?.username || options.auth?.password) {
        const user = options.auth.username || '';
        const pass = options.auth.password || '';
        const authBase64 = Buffer.from(`${user}:${pass}`).toString('base64');
        connectHeaders.push(`Proxy-Authorization: Basic ${authBase64}`);
      }

      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          connectHeaders.push(`${k}: ${v}`);
        }
      }

      connectHeaders.push('\r\n');
      rawSocket.write(connectHeaders.join('\r\n'));

      let buffer = '';
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const headerEndIndex = buffer.indexOf('\r\n\r\n');
        if (headerEndIndex !== -1) {
          rawSocket.removeListener('data', onData);
          cleanup();

          const statusLine = buffer.split('\r\n')[0];
          const match = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/i);
          const statusCode = match ? Number.parseInt(match[1], 10) : 0;

          if (statusCode >= 200 && statusCode < 300) {
            resolve(rawSocket);
          } else {
            rawSocket.destroy();
            reject(new Error(`HTTP CONNECT tunnel failed with status ${statusCode}: ${statusLine}`));
          }
        }
      };

      rawSocket.on('data', onData);
    };

    let socket: net.Socket;

    if (options.isProxyTls) {
      socket = tls.connect({
        host: options.proxyHost,
        port: options.proxyPort,
        servername: options.tlsOptions?.servername || options.proxyHost,
        rejectUnauthorized: options.tlsOptions?.rejectUnauthorized !== false,
        ca: options.tlsOptions?.ca,
        cert: options.tlsOptions?.cert,
        key: options.tlsOptions?.key,
      });
      (socket as tls.TLSSocket).once('secureConnect', () => onConnect(socket));
    } else {
      socket = net.connect({
        host: options.proxyHost,
        port: options.proxyPort,
      });
      socket.once('connect', () => onConnect(socket));
    }

    timer = setTimeout(() => {
      if (!cleanedUp) {
        cleanup();
        socket.destroy(
          new Error(`HTTP CONNECT to ${options.proxyHost}:${options.proxyPort} timed out after ${timeout}ms`),
        );
      }
    }, timeout);

    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Creates a drop-in fetch function that routes requests through an HTTP or HTTPS proxy.
 */
export function createHttpProxyFetch(proxyConfig: ProviderProxyConfig): typeof globalThis.fetch {
  const isHttpsProxy = proxyConfig.type === 'https' || proxyConfig.protocol === 'https:';

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(rawUrl);
    const isTargetHttps = parsedUrl.protocol === 'https:';

    // 1. Fast Path: Native Bun fetch for HTTP/HTTPS proxies if no custom mTLS client certs required
    const hasCustomClientCerts = Boolean(proxyConfig.tls?.cert || proxyConfig.tls?.key);

    if (!hasCustomClientCerts && !isHttpsProxy) {
      try {
        const proxyUrlString = formatProxyUrl(proxyConfig, false);
        const mergedInit: RequestInit & { proxy?: string } = {
          ...init,
          proxy: proxyUrlString,
        };

        if (proxyConfig.headers) {
          const headers = new Headers(mergedInit.headers);
          for (const [k, v] of Object.entries(proxyConfig.headers)) {
            headers.set(k, v);
          }
          mergedInit.headers = headers;
        }

        return await globalThis.fetch(input, mergedInit);
      } catch (_err: unknown) {
        // Fallback to socket CONNECT tunnel if native fetch throws unsupported/network error
      }
    }

    // 2. Resilient Socket Tunneling Path (Supports HTTPS-proxy, TLS-in-TLS, custom mTLS)
    if (init?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    const targetPort = parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : isTargetHttps ? 443 : 80;
    const targetHost = parsedUrl.hostname;

    const tunnelSocket = await createHttpConnectTunnel({
      proxyHost: proxyConfig.host,
      proxyPort: proxyConfig.port,
      isProxyTls: isHttpsProxy,
      targetHost,
      targetPort,
      auth: proxyConfig.auth,
      headers: proxyConfig.headers,
      tlsOptions: proxyConfig.tls,
      timeoutMs: proxyConfig.timeoutMs,
    });

    let transportSocket: net.Socket | tls.TLSSocket = tunnelSocket;

    if (isTargetHttps) {
      transportSocket = await new Promise<tls.TLSSocket>((resolveTls, rejectTls) => {
        const tlsSocket = tls.connect({
          socket: tunnelSocket,
          servername: proxyConfig.tls?.servername || targetHost,
          rejectUnauthorized: proxyConfig.tls?.rejectUnauthorized !== false,
          ca: proxyConfig.tls?.ca,
        });

        tlsSocket.once('secureConnect', () => resolveTls(tlsSocket));
        tlsSocket.once('error', (err) => {
          tunnelSocket.destroy();
          rejectTls(err);
        });
      });
    }

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

      const client = isTargetHttps ? https : http;
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
}
