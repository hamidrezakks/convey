import type { ProviderModule } from '../../core/provider-module';
import { OpsgenieToolAdapter } from './opsgenie.adapter';
import { opsgenieMock } from './opsgenie.mock';

export const adapter = new OpsgenieToolAdapter();

export const opsgenieToolModule: ProviderModule = {
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
  mock: opsgenieMock,
};

export * from './opsgenie.adapter';
export * from './opsgenie.mock';
export * from './opsgenie.transformer';
export * from './types';
export default opsgenieToolModule;
