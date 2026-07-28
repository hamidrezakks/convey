import type { ProviderModule } from '../../core/provider-module';
import { SparkpostEmailAdapter } from './sparkpost.adapter';
import { sparkpostMock } from './sparkpost.mock';

export const adapter = new SparkpostEmailAdapter();

export const sparkpostEmailModule: ProviderModule = {
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
  mock: sparkpostMock,
};

export * from './sparkpost.adapter';
export * from './sparkpost.mock';
export * from './sparkpost.transformer';
export * from './types';
export default sparkpostEmailModule;
