import type { ProviderModule } from '../../core/provider-module';
import { ApnsPushAdapter } from './apns.adapter';
import { apnsMock } from './apns.mock';

export const adapter = new ApnsPushAdapter();

export const apnsPushModule: ProviderModule = {
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
  mock: apnsMock,
};

export * from './apns.adapter';
export * from './apns.mock';
export * from './apns.transformer';
export * from './types';
export default apnsPushModule;
