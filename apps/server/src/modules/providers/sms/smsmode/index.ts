import type { ProviderModule } from '../../core/provider-module';
import { SmsmodeSmsAdapter } from './smsmode.adapter';
import { smsmodeMock } from './smsmode.mock';

export const adapter = new SmsmodeSmsAdapter();

export const smsmodeSmsModule: ProviderModule = {
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
  mock: smsmodeMock,
};

export * from './smsmode.adapter';
export * from './smsmode.mock';
export * from './smsmode.transformer';
export * from './types';
export default smsmodeSmsModule;
