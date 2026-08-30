import { mockConfig } from './config';
import { dispatchMockRequest } from './core/engine';
import { generateProviderId } from './core/id-generator';
import { mockLogger } from './core/logger';
import { type WebSocketClientData, mockWsManager } from './core/websocket-manager';

export function startMockServer(portOverride?: number) {
  const isDiscrete = mockConfig.providerId !== 'all';
  const title = isDiscrete
    ? `⚡ CONVEY MOCK SERVER [${mockConfig.providerId.toUpperCase()}]`
    : '⚡ CONVEY MOCK UNIVERSAL GATEWAY';

  const port = portOverride || Number(process.env.MOCK_PORT) || mockConfig.port;

  const server = Bun.serve<WebSocketClientData>({
    port,
    reusePort: true,
    async fetch(req, server) {
      const url = new URL(req.url);
      const isWsUpgrade = req.headers.get('upgrade')?.toLowerCase() === 'websocket';

      if (isWsUpgrade) {
        let topic: WebSocketClientData['topic'] = 'general';
        const path = url.pathname.toLowerCase();

        if (path.includes('/app/') || path.includes('/pusher') || url.hostname.includes('pusher')) {
          topic = 'pusher';
        } else if (path.includes('/slack') || path.includes('/link') || url.hostname.includes('slack')) {
          topic = 'slack';
        } else if (path.includes('/gateway') || path.includes('/discord') || url.hostname.includes('discord')) {
          topic = 'discord';
        } else if (path.includes('/mattermost') || path.includes('/api/v4/websocket')) {
          topic = 'mattermost';
        } else if (path.includes('/stream')) {
          topic = 'stream';
        } else if (path.includes('/__inspect') || path.includes('/events') || path.includes('/ws')) {
          topic = 'inspector';
        }

        const clientId = generateProviderId('ws');
        const upgraded = server.upgrade(req, {
          data: {
            id: clientId,
            topic,
            connectedAt: new Date(),
          },
        });

        if (upgraded) {
          return undefined;
        }
      }

      return await dispatchMockRequest(req);
    },
    websocket: {
      open(ws) {
        mockWsManager.register(ws);
      },
      message(ws, message) {
        mockWsManager.handleMessage(ws, message);
      },
      close(ws) {
        mockWsManager.unregister(ws);
      },
    },
  });

  mockLogger.info(`${title} started on port ${server.port} (HTTP & WebSocket enabled)`, {
    providerId: mockConfig.providerId,
    port: server.port,
    webhookUrl: mockConfig.webhookUrl,
  });

  return server;
}

if (import.meta.main) {
  startMockServer();
}
