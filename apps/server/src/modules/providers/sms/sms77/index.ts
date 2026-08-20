import type { ProviderModule } from '../../core/provider-module';
import { Sms77SmsAdapter } from './sms77.adapter';
import { sms77Mock } from './sms77.mock';

export const adapter = new Sms77SmsAdapter();

export const sms77SmsModule: ProviderModule = {
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
  mock: sms77Mock,
};

export * from './sms77.adapter';
export * from './sms77.mock';
export * from './sms77.transformer';
export * from './types';
export default sms77SmsModule;
