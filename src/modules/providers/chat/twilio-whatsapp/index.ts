import type { ProviderModule } from '../../core/provider-module';
import { TwilioWhatsappChatAdapter } from './twilio-whatsapp.adapter';
import { twilioWhatsappMock } from './twilio-whatsapp.mock';

export const adapter = new TwilioWhatsappChatAdapter();

export const twilioWhatsappChatModule: ProviderModule = {
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
  mock: twilioWhatsappMock,
};

export * from './twilio-whatsapp.adapter';
export * from './twilio-whatsapp.mock';
export * from './twilio-whatsapp.transformer';
export * from './types';
export default twilioWhatsappChatModule;
