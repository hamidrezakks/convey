import type { ProviderModule } from '../../core/provider-module';
import { FiretextSmsAdapter } from './firetext.adapter';
import { firetextMock } from './firetext.mock';

export const adapter = new FiretextSmsAdapter();

export const firetextSmsModule: ProviderModule = {
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
  mock: firetextMock,
};

export * from './firetext.adapter';
export * from './firetext.mock';
export * from './firetext.transformer';
export * from './types';
export default firetextSmsModule;
