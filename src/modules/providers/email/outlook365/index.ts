import type { ProviderModule } from '../../core/provider-module';
import { Outlook365EmailAdapter } from './outlook365.adapter';
import { outlook365Mock } from './outlook365.mock';

export const adapter = new Outlook365EmailAdapter();

export const outlook365EmailModule: ProviderModule = {
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
  mock: outlook365Mock,
};

export * from './outlook365.adapter';
export * from './outlook365.mock';
export * from './outlook365.transformer';
export * from './types';
export default outlook365EmailModule;
