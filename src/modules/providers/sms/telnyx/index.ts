import type { ProviderModule } from '../../core/provider-module';
import { TelnyxSmsAdapter } from './telnyx.adapter';
import { telnyxMock } from './telnyx.mock';

export const adapter = new TelnyxSmsAdapter();

export const telnyxSmsModule: ProviderModule = {
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
  mock: telnyxMock,
};

export * from './telnyx.adapter';
export * from './telnyx.mock';
export * from './telnyx.transformer';
export * from './types';
export default telnyxSmsModule;
