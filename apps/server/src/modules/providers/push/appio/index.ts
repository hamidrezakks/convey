import type { ProviderModule } from '../../core/provider-module';
import { AppioPushAdapter } from './appio.adapter';
import { appioMock } from './appio.mock';

export const adapter = new AppioPushAdapter();

export const appioPushModule: ProviderModule = {
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
  mock: appioMock,
};

export * from './appio.adapter';
export * from './appio.mock';
export * from './appio.transformer';
export * from './types';
export default appioPushModule;
