import type { ProviderModule } from '../../core/provider-module';
import { KannelSmsAdapter } from './kannel.adapter';
import { kannelMock } from './kannel.mock';

export const adapter = new KannelSmsAdapter();

export const kannelSmsModule: ProviderModule = {
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
  mock: kannelMock,
};

export * from './kannel.adapter';
export * from './kannel.mock';
export * from './kannel.transformer';
export * from './types';
export default kannelSmsModule;
