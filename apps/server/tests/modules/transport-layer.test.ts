import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import http from 'node:http';
import net from 'node:net';
import {
  createHttpConnectTunnel,
  createHttpProxyFetch,
  createSocks5Connection,
  createSocks5Fetch,
  createTransportFetch,
  executeProviderRequest,
  formatProxyUrl,
  isProxyBypassed,
  maskProxyConfig,
  parseProxyUrl,
  testProxyConnectivity,
} from '../../src/modules/providers/core/transport';
import type { ProviderProxyConfig } from '../../src/modules/providers/core/transport/proxy-types';

describe('Transport Layer Proxy Subsystem', () => {
  let targetHttpServer: http.Server;
  let targetHttpPort: number;

  let httpProxyServer: http.Server;
  let httpProxyPort: number;

  let socks5Server: net.Server;
  let socks5Port: number;

  beforeAll(async () => {
    // 1. Target HTTP Server
    targetHttpServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Target-Received': 'true' });
        res.end(
          JSON.stringify({
            status: 'ok',
            method: req.method,
            path: req.url,
            headers: req.headers,
            body: body ? JSON.parse(body) : null,
          }),
        );
      });
    });

    await new Promise<void>((resolve) => {
      targetHttpServer.listen(0, () => {
        targetHttpPort = (targetHttpServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    // 2. HTTP Forward & CONNECT Proxy Server
    httpProxyServer = http.createServer((req, res) => {
      // Forward proxy handler
      const targetUrl = new URL(req.url || '', `http://${req.headers.host}`);
      const proxyReq = http.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || 80,
          path: targetUrl.pathname + targetUrl.search,
          method: req.method,
          headers: {
            ...req.headers,
            'x-forwarded-by-http-proxy': 'convey-http-proxy',
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      req.pipe(proxyReq);
    });

    httpProxyServer.on('connect', (req, clientSocket, head) => {
      const [host, port] = (req.url || '').split(':');
      const serverSocket = net.connect(Number(port || 80), host, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length > 0) serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });
      serverSocket.on('error', () => clientSocket.destroy());
    });

    await new Promise<void>((resolve) => {
      httpProxyServer.listen(0, () => {
        httpProxyPort = (httpProxyServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    // 3. RFC 1928 / RFC 1929 SOCKS5 Server
    socks5Server = net.createServer((clientSocket) => {
      clientSocket.once('data', (rawInitData: Buffer | string) => {
        const data = Buffer.isBuffer(rawInitData) ? rawInitData : Buffer.from(rawInitData);
        if (data[0] !== 5) return clientSocket.destroy();
        const nmethods = data[1] as number;
        const methods = Array.from(data.subarray(2, 2 + nmethods));

        // If client supports USER_PASS (0x02) and offers it, require auth
        if (methods.includes(0x02)) {
          clientSocket.write(Buffer.from([0x05, 0x02]));
          clientSocket.once('data', (rawAuthData: Buffer | string) => {
            const authData = Buffer.isBuffer(rawAuthData) ? rawAuthData : Buffer.from(rawAuthData);
            if (authData[0] !== 0x01) return clientSocket.destroy();
            const ulen = authData[1] as number;
            const user = authData.subarray(2, 2 + ulen).toString();
            const plen = authData[2 + ulen] as number;
            const pass = authData.subarray(3 + ulen, 3 + ulen + plen).toString();

            if (user === 'testuser' && pass === 'testpass') {
              clientSocket.write(Buffer.from([0x01, 0x00])); // Auth success
              handleSocksConnect(clientSocket);
            } else {
              clientSocket.write(Buffer.from([0x01, 0x01])); // Auth fail
              clientSocket.destroy();
            }
          });
        } else {
          // NO_AUTH (0x00)
          clientSocket.write(Buffer.from([0x05, 0x00]));
          handleSocksConnect(clientSocket);
        }
      });
    });

    function handleSocksConnect(clientSocket: net.Socket) {
      clientSocket.once('data', (rawReqData: Buffer | string) => {
        const reqData = Buffer.isBuffer(rawReqData) ? rawReqData : Buffer.from(rawReqData);
        if (reqData[0] !== 5 || reqData[1] !== 1) return clientSocket.destroy(); // CONNECT
        const atyp = reqData[3];
        let targetHost = '';
        let offset = 4;

        if (atyp === 1) {
          targetHost = reqData.subarray(offset, offset + 4).join('.');
          offset += 4;
        } else if (atyp === 3) {
          const len = reqData[offset] as number;
          targetHost = reqData.subarray(offset + 1, offset + 1 + len).toString();
          offset += 1 + len;
        }

        const targetPort = reqData.readUInt16BE(offset);
        const targetSocket = net.connect(targetPort, targetHost, () => {
          clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
          clientSocket.pipe(targetSocket);
          targetSocket.pipe(clientSocket);
        });

        targetSocket.on('error', () => clientSocket.destroy());
      });
    }

    await new Promise<void>((resolve) => {
      socks5Server.listen(0, () => {
        socks5Port = (socks5Server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    targetHttpServer.close();
    httpProxyServer.close();
    socks5Server.close();
  });

  describe('Proxy Matcher & Configuration Utilities', () => {
    it('correctly evaluates noProxy bypass rules for exact, subdomain wildcard, and CIDR ranges', () => {
      const rules = ['localhost', '127.0.0.1', '*.internal.corp', '.localnet', '10.0.0.0/8', '192.168.1.0/24'];

      expect(isProxyBypassed('http://localhost:8080/path', rules)).toBe(true);
      expect(isProxyBypassed('http://127.0.0.1:3000', rules)).toBe(true);
      expect(isProxyBypassed('https://api.internal.corp/v1', rules)).toBe(true);
      expect(isProxyBypassed('https://gateway.localnet/test', rules)).toBe(true);
      expect(isProxyBypassed('http://10.254.1.5:8080', rules)).toBe(true);
      expect(isProxyBypassed('http://192.168.1.55:9000', rules)).toBe(true);

      // Should NOT bypass public internet targets
      expect(isProxyBypassed('https://api.sendgrid.com/v3/mail/send', rules)).toBe(false);
      expect(isProxyBypassed('https://api.twilio.com/2010-04-01', rules)).toBe(false);
      expect(isProxyBypassed('https://api.resend.com/emails', rules)).toBe(false);
      expect(isProxyBypassed('http://172.217.16.206', rules)).toBe(false);
    });

    it('parses raw proxy URLs correctly into structured ProviderProxyConfig', () => {
      const socksParsed = parseProxyUrl('socks5://proxyuser:proxypass@proxy.corp.net:1080');
      expect(socksParsed.type).toBe('socks5');
      expect(socksParsed.host).toBe('proxy.corp.net');
      expect(socksParsed.port).toBe(1080);
      expect(socksParsed.auth?.username).toBe('proxyuser');
      expect(socksParsed.auth?.password).toBe('proxypass');

      const httpParsed = parseProxyUrl('http://10.0.1.50:8080');
      expect(httpParsed.type).toBe('http');
      expect(httpParsed.host).toBe('10.0.1.50');
      expect(httpParsed.port).toBe(8080);
    });

    it('masks proxy passwords securely without altering host or port', () => {
      const config: ProviderProxyConfig = {
        enabled: true,
        type: 'socks5',
        host: 'socks.corp.com',
        port: 1080,
        auth: { username: 'admin', password: 'SuperSecretPassword' },
        rawUrl: 'socks5://admin:SuperSecretPassword@socks.corp.com:1080',
      };

      const masked = maskProxyConfig(config);
      expect(masked?.auth?.password).toBe('***');
      expect(masked?.auth?.username).toBe('admin');
      expect(masked?.rawUrl).toContain('admin:***@socks.corp.com');

      const formatted = formatProxyUrl(config, true);
      expect(formatted).toBe('socks5://admin:***@socks.corp.com:1080');
    });
  });

  describe('HTTP & HTTPS Proxy Transport', () => {
    it('successfully forwards HTTP requests through HTTP proxy', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'http',
        host: '127.0.0.1',
        port: httpProxyPort,
      };

      const transportFetch = createTransportFetch(proxyConfig);
      const res = await transportFetch(`http://127.0.0.1:${targetHttpPort}/test-http`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello-via-http-proxy' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        status: string;
        body: Record<string, unknown>;
        headers: Record<string, string>;
      };
      expect(json.status).toBe('ok');
      expect(json.body.message).toBe('hello-via-http-proxy');
      expect(json.headers['x-forwarded-by-http-proxy']).toBe('convey-http-proxy');
    });

    it('establishes HTTP CONNECT tunnel socket successfully', async () => {
      const tunnel = await createHttpConnectTunnel({
        proxyHost: '127.0.0.1',
        proxyPort: httpProxyPort,
        targetHost: '127.0.0.1',
        targetPort: targetHttpPort,
      });

      expect(tunnel).toBeDefined();
      expect(tunnel.destroyed).toBe(false);

      // Write direct HTTP request into the tunnel
      const httpReq = `POST /tunnel-test HTTP/1.1\r\nHost: 127.0.0.1:${targetHttpPort}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`;
      tunnel.write(httpReq);

      const responseChunk = await new Promise<string>((resolve) => {
        tunnel.once('data', (d) => resolve(d.toString()));
      });

      expect(responseChunk).toContain('HTTP/1.1 200 OK');
      tunnel.destroy();
    });
  });

  describe('SOCKS5 Proxy Transport (RFC 1928 / RFC 1929)', () => {
    it('successfully executes request over SOCKS5 proxy without authentication', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: socks5Port,
      };

      const transportFetch = createTransportFetch(proxyConfig);
      const res = await transportFetch(`http://127.0.0.1:${targetHttpPort}/socks5-unauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transport: 'socks5-no-auth' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string; body: Record<string, unknown> };
      expect(json.status).toBe('ok');
      expect(json.body.transport).toBe('socks5-no-auth');
    });

    it('successfully executes request over SOCKS5 proxy with valid username/password authentication', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: socks5Port,
        auth: {
          username: 'testuser',
          password: 'testpass',
        },
      };

      const transportFetch = createTransportFetch(proxyConfig);
      const res = await transportFetch(`http://127.0.0.1:${targetHttpPort}/socks5-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'authenticated-socks5' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string; body: Record<string, unknown> };
      expect(json.status).toBe('ok');
      expect(json.body.user).toBe('authenticated-socks5');
    });

    it('rejects connection when SOCKS5 authentication fails with wrong credentials', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: socks5Port,
        auth: {
          username: 'wronguser',
          password: 'wrongpassword',
        },
      };

      const transportFetch = createTransportFetch(proxyConfig);
      let failed = false;
      try {
        await transportFetch(`http://127.0.0.1:${targetHttpPort}/should-fail`, {
          method: 'GET',
        });
      } catch (err: unknown) {
        failed = true;
        expect((err as Error).message).toContain('SOCKS5 authentication failed');
      }

      expect(failed).toBe(true);
    });
  });

  describe('executeProviderRequest & Diagnostics', () => {
    it('executes provider request and returns structured data and error categories', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: socks5Port,
      };

      const result = await executeProviderRequest(
        `http://127.0.0.1:${targetHttpPort}/provider-send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: 'user@example.com' }),
        },
        proxyConfig,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect((result.data as Record<string, unknown>).status).toBe('ok');
    });

    it('runs testProxyConnectivity probe and returns latency and diagnostic metrics', async () => {
      const proxyConfig: ProviderProxyConfig = {
        enabled: true,
        type: 'http',
        host: '127.0.0.1',
        port: httpProxyPort,
      };

      const diag = await testProxyConnectivity(proxyConfig, `http://127.0.0.1:${targetHttpPort}/probe`);
      expect(diag.success).toBe(true);
      expect(diag.proxyType).toBe('http');
      expect(diag.proxyHost).toBe('127.0.0.1');
      expect(diag.statusCode).toBe(200);
      expect(diag.e2eLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('Direct Proxy Function Implementations', () => {
    it('directly invokes createHttpProxyFetch', async () => {
      const fetchFn = createHttpProxyFetch({
        enabled: true,
        type: 'http',
        host: '127.0.0.1',
        port: httpProxyPort,
      });
      const res = await fetchFn(`http://127.0.0.1:${targetHttpPort}/direct-http-proxy`);
      expect(res.status).toBe(200);
    });

    it('directly invokes createSocks5Connection and createSocks5Fetch', async () => {
      const sock = await createSocks5Connection({
        proxyHost: '127.0.0.1',
        proxyPort: socks5Port,
        targetHost: '127.0.0.1',
        targetPort: targetHttpPort,
      });
      expect(sock).toBeDefined();
      expect(sock.destroyed).toBe(false);
      sock.destroy();

      const fetchFn = createSocks5Fetch({
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: socks5Port,
      });
      const res = await fetchFn(`http://127.0.0.1:${targetHttpPort}/direct-socks5-proxy`);
      expect(res.status).toBe(200);
    });
  });
});
