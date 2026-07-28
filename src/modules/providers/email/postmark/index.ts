import type { ProviderModule } from '../../core/provider-module';
import { PostmarkEmailAdapter } from './postmark.adapter';
import { postmarkMock } from './postmark.mock';

export const adapter = new PostmarkEmailAdapter();

export const postmarkEmailModule: ProviderModule = {
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
  mock: postmarkMock,
};

export * from './postmark.adapter';
export * from './postmark.mock';
export * from './postmark.transformer';
export * from './types';
export default postmarkEmailModule;
