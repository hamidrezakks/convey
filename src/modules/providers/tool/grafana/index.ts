import type { ProviderModule } from '../../core/provider-module';
import { GrafanaToolAdapter } from './grafana.adapter';
import { grafanaMock } from './grafana.mock';

export const adapter = new GrafanaToolAdapter();

export const grafanaToolModule: ProviderModule = {
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
  mock: grafanaMock,
};

export * from './grafana.adapter';
export * from './grafana.mock';
export * from './grafana.transformer';
export * from './types';
export default grafanaToolModule;
