import type { ProviderModule } from '../../core/provider-module';
import { NexmoSmsAdapter } from './nexmo.adapter';
import { nexmoMock } from './nexmo.mock';

export const adapter = new NexmoSmsAdapter();

export const nexmoSmsModule: ProviderModule = {
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
  mock: nexmoMock,
};

export * from './nexmo.adapter';
export * from './nexmo.mock';
export * from './nexmo.transformer';
export * from './types';
export default nexmoSmsModule;
