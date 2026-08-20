import type { ProviderModule } from '../../core/provider-module';
import { PlunkEmailAdapter } from './plunk.adapter';
import { plunkMock } from './plunk.mock';

export const adapter = new PlunkEmailAdapter();

export const plunkEmailModule: ProviderModule = {
  id: adapter.id,
  channel: adapter.channel,
  capabilities: adapter.capabilities,
  adapter: adapter,
  webhook: adapter.parseWebhook
    ? {
        parsePayload(payload: unknown) {
          return adapter.parseWebhook ? adapter.parseWebhook(payload) : [];
        },
      }
    : undefined,
  mock: plunkMock,
};

export * from './plunk.adapter';
export * from './plunk.mock';
export * from './plunk.transformer';
export * from './types';
export default plunkEmailModule;
