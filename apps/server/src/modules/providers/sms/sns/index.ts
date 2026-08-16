import type { ProviderModule } from '../../core/provider-module';
import { SnsSmsAdapter } from './sns.adapter';
import { snsMock } from './sns.mock';

export const adapter = new SnsSmsAdapter();

export const snsSmsModule: ProviderModule = {
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
  mock: snsMock,
};

export * from './sns.adapter';
export * from './sns.mock';
export * from './sns.transformer';
export * from './types';
export default snsSmsModule;
