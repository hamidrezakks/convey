import type { ProviderModule } from '../../core/provider-module';
import { SendchampSmsAdapter } from './sendchamp.adapter';
import { sendchampMock } from './sendchamp.mock';

export const adapter = new SendchampSmsAdapter();

export const sendchampSmsModule: ProviderModule = {
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
  mock: sendchampMock,
};

export * from './sendchamp.adapter';
export * from './sendchamp.mock';
export * from './sendchamp.transformer';
export * from './types';
export default sendchampSmsModule;
