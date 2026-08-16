import type { ProviderModule } from '../../core/provider-module';
import { BurstSmsSmsAdapter } from './burst-sms.adapter';
import { burstSmsMock } from './burst-sms.mock';

export const adapter = new BurstSmsSmsAdapter();

export const burstSmsSmsModule: ProviderModule = {
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
  mock: burstSmsMock,
};

export * from './burst-sms.adapter';
export * from './burst-sms.mock';
export * from './burst-sms.transformer';
export * from './types';
export default burstSmsSmsModule;
