import type { ProviderModule } from '../../core/provider-module';
import { GetstreamChatAdapter } from './getstream.adapter';
import { getstreamMock } from './getstream.mock';

export const adapter = new GetstreamChatAdapter();

export const getstreamChatModule: ProviderModule = {
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
  mock: getstreamMock,
};

export * from './getstream.adapter';
export * from './getstream.mock';
export * from './getstream.transformer';
export * from './types';
export default getstreamChatModule;
