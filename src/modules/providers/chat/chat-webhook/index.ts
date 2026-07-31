import type { ProviderModule } from '../../core/provider-module';
import { ChatWebhookChatAdapter } from './chat-webhook.adapter';
import { chatWebhookMock } from './chat-webhook.mock';

export const adapter = new ChatWebhookChatAdapter();

export const chatWebhookChatModule: ProviderModule = {
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
  mock: chatWebhookMock,
};

export * from './chat-webhook.adapter';
export * from './chat-webhook.mock';
export * from './chat-webhook.transformer';
export * from './types';
export default chatWebhookChatModule;
