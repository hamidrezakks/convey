import type { ProviderModule } from '../../core/provider-module';
import { BrazeEmailAdapter } from './braze.adapter';
import { brazeMock } from './braze.mock';

export const adapter = new BrazeEmailAdapter();

export const brazeEmailModule: ProviderModule = {
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
  mock: brazeMock,
};

export * from './braze.adapter';
export * from './braze.mock';
export * from './braze.transformer';
export * from './types';
export default brazeEmailModule;
