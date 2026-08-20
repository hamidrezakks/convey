import type { ProviderModule } from '../../core/provider-module';
import { BrevoSmsSmsAdapter } from './brevo-sms.adapter';
import { brevoSmsMock } from './brevo-sms.mock';

export const adapter = new BrevoSmsSmsAdapter();

export const brevoSmsSmsModule: ProviderModule = {
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
  mock: brevoSmsMock,
};

export * from './brevo-sms.adapter';
export * from './brevo-sms.mock';
export * from './brevo-sms.transformer';
export * from './types';
export default brevoSmsSmsModule;
