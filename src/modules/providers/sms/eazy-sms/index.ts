import type { ProviderModule } from '../../core/provider-module';
import { EazySmsSmsAdapter } from './eazy-sms.adapter';
import { eazySmsMock } from './eazy-sms.mock';

export const adapter = new EazySmsSmsAdapter();

export const eazySmsSmsModule: ProviderModule = {
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
  mock: eazySmsMock,
};

export * from './eazy-sms.adapter';
export * from './eazy-sms.mock';
export * from './eazy-sms.transformer';
export * from './types';
export default eazySmsSmsModule;
