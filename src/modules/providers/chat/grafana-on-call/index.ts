import type { ProviderModule } from '../../core/provider-module';
import { GrafanaOnCallChatAdapter } from './grafana-on-call.adapter';
import { grafanaOnCallMock } from './grafana-on-call.mock';

export const adapter = new GrafanaOnCallChatAdapter();

export const grafanaOnCallChatModule: ProviderModule = {
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
  mock: grafanaOnCallMock,
};

export * from './grafana-on-call.adapter';
export * from './grafana-on-call.mock';
export * from './grafana-on-call.transformer';
export * from './types';
export default grafanaOnCallChatModule;
