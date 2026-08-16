import type { ProviderModule } from '../../core/provider-module';
import { InfobipEmailAdapter } from './infobip.adapter';
import { infobipMock } from './infobip.mock';

export const adapter = new InfobipEmailAdapter();

export const infobipEmailModule: ProviderModule = {
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
  mock: infobipMock,
};

export * from './infobip.adapter';
export * from './infobip.mock';
export * from './infobip.transformer';
export * from './types';
export default infobipEmailModule;
