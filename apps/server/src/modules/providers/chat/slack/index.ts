import type { ProviderModule } from '../../core/provider-module';
import { SlackChatAdapter } from './slack.adapter';
import { slackMock } from './slack.mock';

export const adapter = new SlackChatAdapter();

export const slackChatModule: ProviderModule = {
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
  mock: slackMock,
};

export * from './slack.adapter';
export * from './slack.mock';
export * from './slack.transformer';
export * from './types';
export default slackChatModule;
