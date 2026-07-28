import type { ProviderModule } from '../../core/provider-module';
import { MandrillEmailAdapter } from './mandrill.adapter';
import { mandrillMock } from './mandrill.mock';

export const adapter = new MandrillEmailAdapter();

export const mandrillEmailModule: ProviderModule = {
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
  mock: mandrillMock,
};

export * from './mandrill.adapter';
export * from './mandrill.mock';
export * from './mandrill.transformer';
export * from './types';
export default mandrillEmailModule;
