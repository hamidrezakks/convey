import type { ProviderModule } from '../../core/provider-module';
import { RuachSmsSmsAdapter } from './ruach-sms.adapter';
import { ruachSmsMock } from './ruach-sms.mock';

export const adapter = new RuachSmsSmsAdapter();

export const ruachSmsSmsModule: ProviderModule = {
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
  mock: ruachSmsMock,
};

export * from './ruach-sms.adapter';
export * from './ruach-sms.mock';
export * from './ruach-sms.transformer';
export * from './types';
export default ruachSmsSmsModule;
