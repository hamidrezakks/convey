import type { ProviderModule } from '../../core/provider-module';
import { SesEmailAdapter } from './ses.adapter';
import { sesMock } from './ses.mock';

export const adapter = new SesEmailAdapter();

export const sesEmailModule: ProviderModule = {
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
  mock: sesMock,
};

export * from './ses.adapter';
export * from './ses.mock';
export * from './ses.transformer';
export * from './types';
export default sesEmailModule;
