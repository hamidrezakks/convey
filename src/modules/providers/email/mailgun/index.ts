import type { ProviderModule } from '../../core/provider-module';
import { MailgunEmailAdapter } from './mailgun.adapter';
import { mailgunMock } from './mailgun.mock';

export const adapter = new MailgunEmailAdapter();

export const mailgunEmailModule: ProviderModule = {
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
  mock: mailgunMock,
};

export * from './mailgun.adapter';
export * from './mailgun.mock';
export * from './mailgun.transformer';
export * from './types';
export default mailgunEmailModule;
