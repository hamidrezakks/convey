import type { ProviderModule } from '../../core/provider-module';
import { FcmPushAdapter } from './fcm.adapter';
import { fcmMock } from './fcm.mock';

export const adapter = new FcmPushAdapter();

export const fcmPushModule: ProviderModule = {
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
  mock: fcmMock,
};

export * from './fcm.adapter';
export * from './fcm.mock';
export * from './fcm.transformer';
export * from './types';
export default fcmPushModule;
