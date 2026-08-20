import type { ProviderModule } from '../../core/provider-module';
import { MobishastraSmsAdapter } from './mobishastra.adapter';
import { mobishastraMock } from './mobishastra.mock';

export const adapter = new MobishastraSmsAdapter();

export const mobishastraSmsModule: ProviderModule = {
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
  mock: mobishastraMock,
};

export * from './mobishastra.adapter';
export * from './mobishastra.mock';
export * from './mobishastra.transformer';
export * from './types';
export default mobishastraSmsModule;
