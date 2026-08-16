import type { ProviderModule } from '../../core/provider-module';
import { AnypostEmailAdapter } from './anypost.adapter';
import { anypostMock } from './anypost.mock';

export const adapter = new AnypostEmailAdapter();

export const anypostEmailModule: ProviderModule = {
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
  mock: anypostMock,
};

export * from './anypost.adapter';
export * from './anypost.mock';
export * from './anypost.transformer';
export * from './types';
export default anypostEmailModule;
