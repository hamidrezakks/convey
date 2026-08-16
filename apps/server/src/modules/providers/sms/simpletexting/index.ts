import type { ProviderModule } from '../../core/provider-module';
import { SimpletextingSmsAdapter } from './simpletexting.adapter';
import { simpletextingMock } from './simpletexting.mock';

export const adapter = new SimpletextingSmsAdapter();

export const simpletextingSmsModule: ProviderModule = {
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
  mock: simpletextingMock,
};

export * from './simpletexting.adapter';
export * from './simpletexting.mock';
export * from './simpletexting.transformer';
export * from './types';
export default simpletextingSmsModule;
