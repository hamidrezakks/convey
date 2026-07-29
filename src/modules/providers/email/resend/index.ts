import type { ProviderModule } from '../../core/provider-module';
import { ResendEmailAdapter } from './resend.adapter';
import { resendMock } from './resend.mock';

export const adapter = new ResendEmailAdapter();

export const resendEmailModule: ProviderModule = {
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
  mock: resendMock,
};

export * from './resend.adapter';
export * from './resend.mock';
export * from './resend.transformer';
export * from './types';
export default resendEmailModule;
