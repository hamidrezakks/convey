import type { ProviderModule } from '../../core/provider-module';
import { GupshupSmsAdapter } from './gupshup.adapter';
import { gupshupMock } from './gupshup.mock';

export const adapter = new GupshupSmsAdapter();

export const gupshupSmsModule: ProviderModule = {
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
  mock: gupshupMock,
};

export * from './gupshup.adapter';
export * from './gupshup.mock';
export * from './gupshup.transformer';
export * from './types';
export default gupshupSmsModule;
