import type { ProviderModule } from '../../core/provider-module';
import { MailtrapEmailAdapter } from './mailtrap.adapter';
import { mailtrapMock } from './mailtrap.mock';

export const adapter = new MailtrapEmailAdapter();

export const mailtrapEmailModule: ProviderModule = {
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
  mock: mailtrapMock,
};

export * from './mailtrap.adapter';
export * from './mailtrap.mock';
export * from './mailtrap.transformer';
export * from './types';
export default mailtrapEmailModule;
