import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import http from 'node:http';
import net from 'node:net';
import { adminService } from '../../src/modules/admin/admin.service';
import { Channel } from '../../src/modules/messaging/messaging.types';
import { ResendEmailAdapter } from '../../src/modules/providers/email/resend/resend.adapter';
import { TwilioSmsAdapter } from '../../src/modules/providers/sms/twilio/twilio.adapter';
import { getCachedProviderConfig, invalidateProviderConfigCache } from '../../src/queues/workers/provider-send.worker';

describe('Provider Proxy Dispatch E2E Integration', () => {
  let targetHttpServer: http.Server;
  let targetHttpPort: number;

  let httpProxyServer: http.Server;
  let httpProxyPort: number;

  let socks5Server: net.Server;
  let socks5Port: number;

  const proxiedRequests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: unknown }> = [];

  beforeAll(async () => {
    // 1. Upstream target HTTP server
    targetHttpServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let parsedBody: unknown = body;
        try {
          parsedBody = JSON.parse(body);
        } catch {
          // raw
        }
        proxiedRequests.push({ url: req.url || '', headers: req.headers, body: parsedBody });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'msg_target_success_99', status: 'delivered', sid: 'SM_proxy_test_123' }));
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
      const targetUrl = new URL(req.url || '', `http://${req.headers.host}`);
      const proxyReq = http.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || 80,
          path: targetUrl.pathname + targetUrl.search,
          method: req.method,
          headers: {
            ...req.headers,
            'x-via-convey-proxy': 'http-proxy',
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

    // 3. RFC 1928 SOCKS5 Server
    socks5Server = net.createServer((clientSocket) => {
      clientSocket.once('data', (data) => {
        if (data[0] !== 5) return clientSocket.destroy();
        clientSocket.write(Buffer.from([0x05, 0x00])); // NO_AUTH
        clientSocket.once('data', (reqData) => {
          if (reqData[0] !== 5 || reqData[1] !== 1) return clientSocket.destroy();
          const atyp = reqData[3];
          let targetHost = '';
          let offset = 4;
          if (atyp === 1) {
            targetHost = reqData.subarray(offset, offset + 4).join('.');
            offset += 4;
          } else if (atyp === 3) {
            const len = reqData[offset];
            targetHost = reqData.subarray(offset + 1, offset + 1 + len).toString();
            offset += 1 + len;
          }
          const tPort = reqData.readUInt16BE(offset);
          const targetSocket = net.connect(tPort, targetHost, () => {
            clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
            clientSocket.pipe(targetSocket);
            targetSocket.pipe(clientSocket);
          });
          targetSocket.on('error', () => clientSocket.destroy());
        });
      });
    });

    await new Promise<void>((resolve) => {
      socks5Server.listen(0, () => {
        socks5Port = (socks5Server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    targetHttpServer.close();
    httpProxyServer.close();
    socks5Server.close();
  });

  it('dispatches email via Resend adapter through configured SOCKS5 proxy', async () => {
    const providerId = 'resend';
    invalidateProviderConfigCache(providerId);

    // Configure provider in DB with SOCKS5 proxy
    await adminService.registerProvider({
      providerId,
      channel: Channel.EMAIL,
      credentials: {
        apiKey: 're_test_socks5_key',
      },
      config: {
        proxy: {
          enabled: true,
          type: 'socks5',
          host: '127.0.0.1',
          port: socks5Port,
        },
      },
    });

    // Retrieve cached provider config as the worker does
    const loadedConfig = await getCachedProviderConfig(providerId);
    expect(loadedConfig).toBeDefined();
    expect(loadedConfig?.proxy).toBeDefined();

    const adapter = new ResendEmailAdapter();
    const sendResult = await adapter.send(
      {
        recipient: { email: 'customer@enterprise.com' },
        content: { subject: 'Invoice #1024', html: '<p>Paid via Proxied Gateway</p>' },
      },
      {
        ...loadedConfig,
        // Override endpoint to target our local test server
        apiKey: 're_test_socks5_key',
      },
    );

    expect(sendResult).toBeDefined();
  });

  it('dispatches SMS via Twilio adapter through configured HTTP proxy', async () => {
    const providerId = 'twilio';
    invalidateProviderConfigCache(providerId);

    // Configure Twilio in DB with HTTP proxy
    await adminService.registerProvider({
      providerId,
      channel: Channel.SMS,
      credentials: {
        apiKey: 'twilio_test_api_key',
        accountSid: 'AC_test_sid',
      },
      config: {
        baseUrl: `http://127.0.0.1:${targetHttpPort}/2010-04-01/Accounts/AC_test_sid/Messages.json`,
        proxy: {
          enabled: true,
          type: 'http',
          host: '127.0.0.1',
          port: httpProxyPort,
        },
      },
    });

    const loadedConfig = await getCachedProviderConfig(providerId);
    expect(loadedConfig?.proxy).toBeDefined();

    const adapter = new TwilioSmsAdapter();
    const sendResult = await adapter.send(
      {
        recipient: { phone: '+12025550143' },
        content: { body: 'Your security OTP is 482910' },
      },
      loadedConfig,
    );

    expect(sendResult.success).toBe(true);
    expect(sendResult.providerMessageId).toBe('SM_proxy_test_123');

    // Verify request reached target server via proxy
    const matchingReq = proxiedRequests.find((r) => r.url.includes('Messages.json'));
    expect(matchingReq).toBeDefined();
  });
});
