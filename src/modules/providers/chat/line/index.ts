import type { ProviderModule } from '../../core/provider-module';
import { LineChatAdapter } from './line.adapter';
import { lineMock } from './line.mock';

export const adapter = new LineChatAdapter();

export const lineChatModule: ProviderModule = {
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
  mock: lineMock,
};

export * from './line.adapter';
export * from './line.mock';
export * from './line.transformer';
export * from './types';
export default lineChatModule;
