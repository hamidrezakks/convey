import type { ProviderModule } from '../../core/provider-module';
import { IsendSmsSmsAdapter } from './isend-sms.adapter';
import { isendSmsMock } from './isend-sms.mock';

export const adapter = new IsendSmsSmsAdapter();

export const isendSmsSmsModule: ProviderModule = {
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
  mock: isendSmsMock,
};

export * from './isend-sms.adapter';
export * from './isend-sms.mock';
export * from './isend-sms.transformer';
export * from './types';
export default isendSmsSmsModule;
