import type { ProviderModule } from '../../core/provider-module';
import { TwilioSmsAdapter } from './twilio.adapter';
import { twilioMock } from './twilio.mock';

export const adapter = new TwilioSmsAdapter();

export const twilioSmsModule: ProviderModule = {
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
  mock: twilioMock,
};

export * from './twilio.adapter';
export * from './twilio.mock';
export * from './twilio.transformer';
export * from './types';
export default twilioSmsModule;
