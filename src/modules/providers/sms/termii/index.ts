import type { ProviderModule } from '../../core/provider-module';
import { TermiiSmsAdapter } from './termii.adapter';
import { termiiMock } from './termii.mock';

export const adapter = new TermiiSmsAdapter();

export const termiiSmsModule: ProviderModule = {
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
  mock: termiiMock,
};

export * from './termii.adapter';
export * from './termii.mock';
export * from './termii.transformer';
export * from './types';
export default termiiSmsModule;
