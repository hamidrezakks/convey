import type { ProviderModule } from '../../core/provider-module';
import { BulkSmsSmsAdapter } from './bulk-sms.adapter';
import { bulkSmsMock } from './bulk-sms.mock';

export const adapter = new BulkSmsSmsAdapter();

export const bulkSmsSmsModule: ProviderModule = {
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
  mock: bulkSmsMock,
};

export * from './bulk-sms.adapter';
export * from './bulk-sms.mock';
export * from './bulk-sms.transformer';
export * from './types';
export default bulkSmsSmsModule;
