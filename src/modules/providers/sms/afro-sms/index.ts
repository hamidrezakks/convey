import type { ProviderModule } from '../../core/provider-module';
import { AfroSmsSmsAdapter } from './afro-sms.adapter';
import { afroSmsMock } from './afro-sms.mock';

export const adapter = new AfroSmsSmsAdapter();

export const afroSmsSmsModule: ProviderModule = {
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
  mock: afroSmsMock,
};

export * from './afro-sms.adapter';
export * from './afro-sms.mock';
export * from './afro-sms.transformer';
export * from './types';
export default afroSmsSmsModule;
