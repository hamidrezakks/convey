import type { ProviderModule } from '../../core/provider-module';
import { DiscordChatAdapter } from './discord.adapter';
import { discordMock } from './discord.mock';

export const adapter = new DiscordChatAdapter();

export const discordChatModule: ProviderModule = {
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
  mock: discordMock,
};

export * from './discord.adapter';
export * from './discord.mock';
export * from './discord.transformer';
export * from './types';
export default discordChatModule;
