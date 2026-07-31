import type { ProviderModule } from '../../core/provider-module';
import { MattermostChatAdapter } from './mattermost.adapter';
import { mattermostMock } from './mattermost.mock';

export const adapter = new MattermostChatAdapter();

export const mattermostChatModule: ProviderModule = {
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
  mock: mattermostMock,
};

export * from './mattermost.adapter';
export * from './mattermost.mock';
export * from './mattermost.transformer';
export * from './types';
export default mattermostChatModule;
