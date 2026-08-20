import type { ProviderModule } from '../../core/provider-module';
import { EmailWebhookEmailAdapter } from './email-webhook.adapter';
import { emailWebhookMock } from './email-webhook.mock';

export const adapter = new EmailWebhookEmailAdapter();

export const emailWebhookEmailModule: ProviderModule = {
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
  mock: emailWebhookMock,
};

export * from './email-webhook.adapter';
export * from './email-webhook.mock';
export * from './email-webhook.transformer';
export * from './types';
export default emailWebhookEmailModule;
