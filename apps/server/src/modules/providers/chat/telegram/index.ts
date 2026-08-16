import type { ProviderModule } from '../../core/provider-module';
import { TelegramChatAdapter } from './telegram.adapter';
import { telegramMock } from './telegram.mock';

export const adapter = new TelegramChatAdapter();

export const telegramChatModule: ProviderModule = {
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
  mock: telegramMock,
};

export * from './telegram.adapter';
export * from './telegram.mock';
export * from './telegram.transformer';
export * from './types';
export default telegramChatModule;
