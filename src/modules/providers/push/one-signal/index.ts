import type { ProviderModule } from '../../core/provider-module';
import { OneSignalPushAdapter } from './one-signal.adapter';
import { oneSignalMock } from './one-signal.mock';

export const adapter = new OneSignalPushAdapter();

export const oneSignalPushModule: ProviderModule = {
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
  mock: oneSignalMock,
};

export * from './one-signal.adapter';
export * from './one-signal.mock';
export * from './one-signal.transformer';
export * from './types';
export default oneSignalPushModule;
