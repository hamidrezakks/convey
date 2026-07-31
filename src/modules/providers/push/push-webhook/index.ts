import type { ProviderModule } from '../../core/provider-module';
import { PushWebhookPushAdapter } from './push-webhook.adapter';
import { pushWebhookMock } from './push-webhook.mock';

export const adapter = new PushWebhookPushAdapter();

export const pushWebhookPushModule: ProviderModule = {
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
  mock: pushWebhookMock,
};

export * from './push-webhook.adapter';
export * from './push-webhook.mock';
export * from './push-webhook.transformer';
export * from './types';
export default pushWebhookPushModule;
