import type { ProviderModule } from '../../core/provider-module';
import { GenericSmsSmsAdapter } from './generic-sms.adapter';
import { genericSmsMock } from './generic-sms.mock';

export const adapter = new GenericSmsSmsAdapter();

export const genericSmsSmsModule: ProviderModule = {
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
  mock: genericSmsMock,
};

export * from './generic-sms.adapter';
export * from './generic-sms.mock';
export * from './generic-sms.transformer';
export * from './types';
export default genericSmsSmsModule;
