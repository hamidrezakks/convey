import type { ProviderModule } from '../../core/provider-module';
import { ExpoPushAdapter } from './expo.adapter';
import { expoMock } from './expo.mock';

export const adapter = new ExpoPushAdapter();

export const expoPushModule: ProviderModule = {
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
  mock: expoMock,
};

export * from './expo.adapter';
export * from './expo.mock';
export * from './expo.transformer';
export * from './types';
export default expoPushModule;
