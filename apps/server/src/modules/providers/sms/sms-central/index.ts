import type { ProviderModule } from '../../core/provider-module';
import { SmsCentralSmsAdapter } from './sms-central.adapter';
import { smsCentralMock } from './sms-central.mock';

export const adapter = new SmsCentralSmsAdapter();

export const smsCentralSmsModule: ProviderModule = {
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
  mock: smsCentralMock,
};

export * from './sms-central.adapter';
export * from './sms-central.mock';
export * from './sms-central.transformer';
export * from './types';
export default smsCentralSmsModule;
