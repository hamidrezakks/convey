import type { ProviderModule } from '../../core/provider-module';
import { MailjetEmailAdapter } from './mailjet.adapter';
import { mailjetMock } from './mailjet.mock';

export const adapter = new MailjetEmailAdapter();

export const mailjetEmailModule: ProviderModule = {
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
  mock: mailjetMock,
};

export * from './mailjet.adapter';
export * from './mailjet.mock';
export * from './mailjet.transformer';
export * from './types';
export default mailjetEmailModule;
