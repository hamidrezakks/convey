import type { ProviderModule } from '../../core/provider-module';
import { BandwidthSmsAdapter } from './bandwidth.adapter';
import { bandwidthMock } from './bandwidth.mock';

export const adapter = new BandwidthSmsAdapter();

export const bandwidthSmsModule: ProviderModule = {
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
  mock: bandwidthMock,
};

export * from './bandwidth.adapter';
export * from './bandwidth.mock';
export * from './bandwidth.transformer';
export * from './types';
export default bandwidthSmsModule;
