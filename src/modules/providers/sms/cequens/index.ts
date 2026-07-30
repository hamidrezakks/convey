import type { ProviderModule } from '../../core/provider-module';
import { CequensSmsAdapter } from './cequens.adapter';
import { cequensMock } from './cequens.mock';

export const adapter = new CequensSmsAdapter();

export const cequensSmsModule: ProviderModule = {
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
  mock: cequensMock,
};

export * from './cequens.adapter';
export * from './cequens.mock';
export * from './cequens.transformer';
export * from './types';
export default cequensSmsModule;
