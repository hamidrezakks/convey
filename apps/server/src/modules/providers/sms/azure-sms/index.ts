import type { ProviderModule } from '../../core/provider-module';
import { AzureSmsSmsAdapter } from './azure-sms.adapter';
import { azureSmsMock } from './azure-sms.mock';

export const adapter = new AzureSmsSmsAdapter();

export const azureSmsSmsModule: ProviderModule = {
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
  mock: azureSmsMock,
};

export * from './azure-sms.adapter';
export * from './azure-sms.mock';
export * from './azure-sms.transformer';
export * from './types';
export default azureSmsSmsModule;
