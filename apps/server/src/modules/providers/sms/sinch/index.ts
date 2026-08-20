import type { ProviderModule } from '../../core/provider-module';
import { SinchSmsAdapter } from './sinch.adapter';
import { sinchMock } from './sinch.mock';

export const adapter = new SinchSmsAdapter();

export const sinchSmsModule: ProviderModule = {
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
  mock: sinchMock,
};

export * from './sinch.adapter';
export * from './sinch.mock';
export * from './sinch.transformer';
export * from './types';
export default sinchSmsModule;
