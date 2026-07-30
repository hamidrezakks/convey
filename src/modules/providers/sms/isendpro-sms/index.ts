import type { ProviderModule } from '../../core/provider-module';
import { IsendproSmsSmsAdapter } from './isendpro-sms.adapter';
import { isendproSmsMock } from './isendpro-sms.mock';

export const adapter = new IsendproSmsSmsAdapter();

export const isendproSmsSmsModule: ProviderModule = {
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
  mock: isendproSmsMock,
};

export * from './isendpro-sms.adapter';
export * from './isendpro-sms.mock';
export * from './isendpro-sms.transformer';
export * from './types';
export default isendproSmsSmsModule;
