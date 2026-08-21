import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import http from 'node:http';
import net from 'node:net';
import { Channel, type ProviderProxyConfig } from '@convey/shared';
import { adminService } from '../../src/modules/admin/admin.service';

describe('Admin Service & Controller Proxy Integration', () => {
  let mockProxyServer: http.Server;
  let mockProxyPort: number;

  let mockTargetServer: http.Server;
  let mockTargetPort: number;

  beforeAll(async () => {
    mockTargetServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', msg: 'target-response' }));
    });

    await new Promise<void>((resolve) => {
      mockTargetServer.listen(0, () => {
        mockTargetPort = (mockTargetServer.address() as net.AddressInfo).port;
        resolve();
      });
    });

    mockProxyServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', msg: 'mock-proxy-ack' }));
    });

    mockProxyServer.on('connect', (_req, clientSocket, head) => {
      const serverSocket = net.connect(mockTargetPort, '127.0.0.1', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length > 0) serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });
      serverSocket.on('error', () => clientSocket.destroy());
    });

    await new Promise<void>((resolve) => {
      mockProxyServer.listen(0, () => {
        mockProxyPort = (mockProxyServer.address() as net.AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    mockProxyServer.close();
    mockTargetServer.close();
  });

  it('registers a provider with SOCKS5 proxy configuration and masks credentials on retrieval', async () => {
    const proxyConfig: ProviderProxyConfig = {
      enabled: true,
      type: 'socks5',
      host: '127.0.0.1',
      port: 1080,
      auth: {
        username: 'corp_proxy_user',
        password: 'TopSecretPassword99!',
      },
      noProxy: ['localhost', '*.internal'],
    };

    const registered = await adminService.registerProvider({
      providerId: 'sendgrid',
      channel: Channel.EMAIL,
      credentials: {
        SENDGRID_API_KEY: 'SG.real_secret_token_123',
      },
      config: {
        proxy: proxyConfig,
        email: { openTracking: true },
      },
    });

    expect(registered.providerId).toBe('sendgrid');
    expect(registered.credentialsMasked.SENDGRID_API_KEY).toContain('•');
    const registeredProxy = registered.config?.proxy as ProviderProxyConfig | undefined;
    expect(registeredProxy?.enabled).toBe(true);
    expect(registeredProxy?.auth?.password).toBe('***');
    expect(registeredProxy?.auth?.username).toBe('corp_proxy_user');

    // Verify retrieval via getConfiguredProviders
    const allConfigured = await adminService.getConfiguredProviders();
    const sendgrid = allConfigured.find((p) => p.providerId === 'sendgrid');
    expect(sendgrid).toBeDefined();
    const sendgridProxy = sendgrid?.config?.proxy as ProviderProxyConfig | undefined;
    expect(sendgridProxy?.auth?.password).toBe('***');
    expect(sendgridProxy?.host).toBe('127.0.0.1');

    // Update sendgrid without re-providing password (sending '***')
    const updated = await adminService.registerProvider({
      providerId: 'sendgrid',
      channel: Channel.EMAIL,
      credentials: {
        SENDGRID_API_KEY: '***',
      },
      config: {
        proxy: {
          ...proxyConfig,
          auth: { username: 'corp_proxy_user', password: '***' },
        },
      },
    });

    const updatedProxy = updated.config?.proxy as ProviderProxyConfig | undefined;
    expect(updatedProxy?.auth?.password).toBe('***');
  });

  it('tests provider connection with proxy diagnostics probe', async () => {
    const proxyConfig: ProviderProxyConfig = {
      enabled: true,
      type: 'http',
      host: '127.0.0.1',
      port: mockProxyPort,
    };

    const result = await adminService.testProviderConnection(
      'resend',
      { apiKey: 're_test_key' },
      { proxy: proxyConfig },
      `http://127.0.0.1:${mockTargetPort}/probe`,
    );

    expect(result.success).toBe(true);
    expect(result.providerId).toBe('resend');
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.proxyType).toBe('http');
    expect(result.diagnostics?.proxyHost).toBe('127.0.0.1');
    expect(result.diagnostics?.e2eLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('performs standalone testProxyConnection probe', async () => {
    const probe = await adminService.testProxyConnection(
      {
        enabled: true,
        type: 'http',
        host: '127.0.0.1',
        port: mockProxyPort,
      },
      `http://127.0.0.1:${mockTargetPort}/probe`,
    );

    expect(probe.success).toBe(true);
    expect(probe.proxyType).toBe('http');
    expect(probe.proxyHost).toBe('127.0.0.1');
    expect(probe.proxyPort).toBe(mockProxyPort);
  });
});
