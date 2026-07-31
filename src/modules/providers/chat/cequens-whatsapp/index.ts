import type { ProviderModule } from '../../core/provider-module';
import { CequensWhatsappChatAdapter } from './cequens-whatsapp.adapter';
import { cequensWhatsappMock } from './cequens-whatsapp.mock';

export const adapter = new CequensWhatsappChatAdapter();

export const cequensWhatsappChatModule: ProviderModule = {
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
  mock: cequensWhatsappMock,
};

export * from './cequens-whatsapp.adapter';
export * from './cequens-whatsapp.mock';
export * from './cequens-whatsapp.transformer';
export * from './types';
export default cequensWhatsappChatModule;
