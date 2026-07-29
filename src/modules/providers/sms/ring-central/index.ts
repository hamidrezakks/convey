import type { ProviderModule } from '../../core/provider-module';
import { RingCentralSmsAdapter } from './ring-central.adapter';
import { ringCentralMock } from './ring-central.mock';

export const adapter = new RingCentralSmsAdapter();

export const ringCentralSmsModule: ProviderModule = {
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
  mock: ringCentralMock,
};

export * from './ring-central.adapter';
export * from './ring-central.mock';
export * from './ring-central.transformer';
export * from './types';
export default ringCentralSmsModule;
