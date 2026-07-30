import type { ProviderModule } from '../../core/provider-module';
import { PlivoSmsAdapter } from './plivo.adapter';
import { plivoMock } from './plivo.mock';

export const adapter = new PlivoSmsAdapter();

export const plivoSmsModule: ProviderModule = {
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
  mock: plivoMock,
};

export * from './plivo.adapter';
export * from './plivo.mock';
export * from './plivo.transformer';
export * from './types';
export default plivoSmsModule;
