import type { ProviderModule } from '../../core/provider-module';
import { ClickatellSmsAdapter } from './clickatell.adapter';
import { clickatellMock } from './clickatell.mock';

export const adapter = new ClickatellSmsAdapter();

export const clickatellSmsModule: ProviderModule = {
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
  mock: clickatellMock,
};

export * from './clickatell.adapter';
export * from './clickatell.mock';
export * from './clickatell.transformer';
export * from './types';
export default clickatellSmsModule;
