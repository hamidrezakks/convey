import type { ProviderModule } from '../../core/provider-module';
import { ClicksendSmsAdapter } from './clicksend.adapter';
import { clicksendMock } from './clicksend.mock';

export const adapter = new ClicksendSmsAdapter();

export const clicksendSmsModule: ProviderModule = {
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
  mock: clicksendMock,
};

export * from './clicksend.adapter';
export * from './clicksend.mock';
export * from './clicksend.transformer';
export * from './types';
export default clicksendSmsModule;
