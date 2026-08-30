import { mockConfig } from './config';
import { dispatchMockRequest } from './core/engine';
import { mockLogger } from './core/logger';

export function startMockServer() {
  const isDiscrete = mockConfig.providerId !== 'all';
  const title = isDiscrete
    ? `⚡ CONVEY MOCK SERVER [${mockConfig.providerId.toUpperCase()}]`
    : '⚡ CONVEY MOCK UNIVERSAL GATEWAY';

  const server = Bun.serve({
    port: mockConfig.port,
    reusePort: true,
    async fetch(req) {
      return await dispatchMockRequest(req);
    },
  });

  mockLogger.info(`${title} started on port ${server.port}`, {
    providerId: mockConfig.providerId,
    port: server.port,
    webhookUrl: mockConfig.webhookUrl,
  });

  return server;
}

if (import.meta.main) {
  startMockServer();
}
