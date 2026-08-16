import type { ProviderModule } from '../../core/provider-module';
import { BrevoEmailAdapter } from './brevo.adapter';
import { brevoMock } from './brevo.mock';

export const adapter = new BrevoEmailAdapter();

export const brevoEmailModule: ProviderModule = {
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
  mock: brevoMock,
};

export * from './brevo.adapter';
export * from './brevo.mock';
export * from './brevo.transformer';
export * from './types';
export default brevoEmailModule;
