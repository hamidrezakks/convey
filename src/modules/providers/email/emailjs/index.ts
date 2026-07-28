import type { ProviderModule } from '../../core/provider-module';
import { EmailjsEmailAdapter } from './emailjs.adapter';
import { emailjsMock } from './emailjs.mock';

export const adapter = new EmailjsEmailAdapter();

export const emailjsEmailModule: ProviderModule = {
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
  mock: emailjsMock,
};

export * from './emailjs.adapter';
export * from './emailjs.mock';
export * from './emailjs.transformer';
export * from './types';
export default emailjsEmailModule;
