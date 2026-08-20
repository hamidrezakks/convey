import type { ProviderModule } from '../../core/provider-module';
import { PushpadPushAdapter } from './pushpad.adapter';
import { pushpadMock } from './pushpad.mock';

export const adapter = new PushpadPushAdapter();

export const pushpadPushModule: ProviderModule = {
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
  mock: pushpadMock,
};

export * from './pushpad.adapter';
export * from './pushpad.mock';
export * from './pushpad.transformer';
export * from './types';
export default pushpadPushModule;
