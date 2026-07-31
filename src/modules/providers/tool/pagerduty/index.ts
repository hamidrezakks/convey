import type { ProviderModule } from '../../core/provider-module';
import { PagerdutyToolAdapter } from './pagerduty.adapter';
import { pagerdutyMock } from './pagerduty.mock';

export const adapter = new PagerdutyToolAdapter();

export const pagerdutyToolModule: ProviderModule = {
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
  mock: pagerdutyMock,
};

export * from './pagerduty.adapter';
export * from './pagerduty.mock';
export * from './pagerduty.transformer';
export * from './types';
export default pagerdutyToolModule;
