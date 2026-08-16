import type { ProviderModule } from '../../core/provider-module';
import { ImediaSmsAdapter } from './imedia.adapter';
import { imediaMock } from './imedia.mock';

export const adapter = new ImediaSmsAdapter();

export const imediaSmsModule: ProviderModule = {
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
  mock: imediaMock,
};

export * from './imedia.adapter';
export * from './imedia.mock';
export * from './imedia.transformer';
export * from './types';
export default imediaSmsModule;
