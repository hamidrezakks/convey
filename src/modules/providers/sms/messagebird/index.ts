import type { ProviderModule } from '../../core/provider-module';
import { MessagebirdSmsAdapter } from './messagebird.adapter';
import { messagebirdMock } from './messagebird.mock';

export const adapter = new MessagebirdSmsAdapter();

export const messagebirdSmsModule: ProviderModule = {
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
  mock: messagebirdMock,
};

export * from './messagebird.adapter';
export * from './messagebird.mock';
export * from './messagebird.transformer';
export * from './types';
export default messagebirdSmsModule;
