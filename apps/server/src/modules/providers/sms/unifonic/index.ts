import type { ProviderModule } from '../../core/provider-module';
import { UnifonicSmsAdapter } from './unifonic.adapter';
import { unifonicMock } from './unifonic.mock';

export const adapter = new UnifonicSmsAdapter();

export const unifonicSmsModule: ProviderModule = {
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
  mock: unifonicMock,
};

export * from './types';
export * from './unifonic.adapter';
export * from './unifonic.mock';
export * from './unifonic.transformer';
export default unifonicSmsModule;
