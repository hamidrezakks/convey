import type { ProviderModule } from '../../core/provider-module';
import { FortySixElksSmsAdapter } from './forty-six-elks.adapter';
import { fortySixElksMock } from './forty-six-elks.mock';

export const adapter = new FortySixElksSmsAdapter();

export const fortySixElksSmsModule: ProviderModule = {
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
  mock: fortySixElksMock,
};

export * from './forty-six-elks.adapter';
export * from './forty-six-elks.mock';
export * from './forty-six-elks.transformer';
export * from './types';
export default fortySixElksSmsModule;
