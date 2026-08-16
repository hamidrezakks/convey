import type { ProviderModule } from '../../core/provider-module';
import { MailersendEmailAdapter } from './mailersend.adapter';
import { mailersendMock } from './mailersend.mock';

export const adapter = new MailersendEmailAdapter();

export const mailersendEmailModule: ProviderModule = {
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
  mock: mailersendMock,
};

export * from './mailersend.adapter';
export * from './mailersend.mock';
export * from './mailersend.transformer';
export * from './types';
export default mailersendEmailModule;
