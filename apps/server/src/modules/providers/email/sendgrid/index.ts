import type { ProviderModule } from '../../core/provider-module';
import { SendgridEmailAdapter } from './sendgrid.adapter';
import { sendgridMock } from './sendgrid.mock';

export const adapter = new SendgridEmailAdapter();

export const sendgridEmailModule: ProviderModule = {
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
  mock: sendgridMock,
};

export * from './sendgrid.adapter';
export * from './sendgrid.mock';
export * from './sendgrid.transformer';
export * from './types';
export default sendgridEmailModule;
