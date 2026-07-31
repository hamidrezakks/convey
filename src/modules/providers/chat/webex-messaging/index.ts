import type { ProviderModule } from '../../core/provider-module';
import { WebexMessagingChatAdapter } from './webex-messaging.adapter';
import { webexMessagingMock } from './webex-messaging.mock';

export const adapter = new WebexMessagingChatAdapter();

export const webexMessagingChatModule: ProviderModule = {
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
  mock: webexMessagingMock,
};

export * from './webex-messaging.adapter';
export * from './webex-messaging.mock';
export * from './webex-messaging.transformer';
export * from './types';
export default webexMessagingChatModule;
