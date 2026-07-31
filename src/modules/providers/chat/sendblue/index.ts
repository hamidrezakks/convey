import type { ProviderModule } from '../../core/provider-module';
import { SendblueChatAdapter } from './sendblue.adapter';
import { sendblueMock } from './sendblue.mock';

export const adapter = new SendblueChatAdapter();

export const sendblueChatModule: ProviderModule = {
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
  mock: sendblueMock,
};

export * from './sendblue.adapter';
export * from './sendblue.mock';
export * from './sendblue.transformer';
export * from './types';
export default sendblueChatModule;
