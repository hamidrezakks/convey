import type { ProviderModule } from '../../core/provider-module';
import { WhatsappBusinessChatAdapter } from './whatsapp-business.adapter';
import { whatsappBusinessMock } from './whatsapp-business.mock';

export const adapter = new WhatsappBusinessChatAdapter();

export const whatsappBusinessChatModule: ProviderModule = {
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
  mock: whatsappBusinessMock,
};

export * from './whatsapp-business.adapter';
export * from './whatsapp-business.mock';
export * from './whatsapp-business.transformer';
export * from './types';
export default whatsappBusinessChatModule;
