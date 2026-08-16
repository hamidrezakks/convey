import type { ProviderModule } from '../../core/provider-module';
import { ZulipChatAdapter } from './zulip.adapter';
import { zulipMock } from './zulip.mock';

export const adapter = new ZulipChatAdapter();

export const zulipChatModule: ProviderModule = {
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
  mock: zulipMock,
};

export * from './types';
export * from './zulip.adapter';
export * from './zulip.mock';
export * from './zulip.transformer';
export default zulipChatModule;
