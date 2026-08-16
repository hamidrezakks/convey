import type { ProviderModule } from '../../core/provider-module';
import { NetcoreEmailAdapter } from './netcore.adapter';
import { netcoreMock } from './netcore.mock';

export const adapter = new NetcoreEmailAdapter();

export const netcoreEmailModule: ProviderModule = {
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
  mock: netcoreMock,
};

export * from './netcore.adapter';
export * from './netcore.mock';
export * from './netcore.transformer';
export * from './types';
export default netcoreEmailModule;
