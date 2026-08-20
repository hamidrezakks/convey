import type { ProviderModule } from '../../core/provider-module';
import { RyverChatAdapter } from './ryver.adapter';
import { ryverMock } from './ryver.mock';

export const adapter = new RyverChatAdapter();

export const ryverChatModule: ProviderModule = {
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
  mock: ryverMock,
};

export * from './ryver.adapter';
export * from './ryver.mock';
export * from './ryver.transformer';
export * from './types';
export default ryverChatModule;
