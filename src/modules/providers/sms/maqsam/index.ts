import type { ProviderModule } from '../../core/provider-module';
import { MaqsamSmsAdapter } from './maqsam.adapter';
import { maqsamMock } from './maqsam.mock';

export const adapter = new MaqsamSmsAdapter();

export const maqsamSmsModule: ProviderModule = {
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
  mock: maqsamMock,
};

export * from './maqsam.adapter';
export * from './maqsam.mock';
export * from './maqsam.transformer';
export * from './types';
export default maqsamSmsModule;
