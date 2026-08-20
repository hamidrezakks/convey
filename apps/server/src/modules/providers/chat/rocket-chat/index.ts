import type { ProviderModule } from '../../core/provider-module';
import { RocketChatChatAdapter } from './rocket-chat.adapter';
import { rocketChatMock } from './rocket-chat.mock';

export const adapter = new RocketChatChatAdapter();

export const rocketChatChatModule: ProviderModule = {
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
  mock: rocketChatMock,
};

export * from './rocket-chat.adapter';
export * from './rocket-chat.mock';
export * from './rocket-chat.transformer';
export * from './types';
export default rocketChatChatModule;
