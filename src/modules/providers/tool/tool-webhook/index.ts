import type { ProviderModule } from '../../core/provider-module';
import { ToolWebhookToolAdapter } from './tool-webhook.adapter';
import { toolWebhookMock } from './tool-webhook.mock';

export const adapter = new ToolWebhookToolAdapter();

export const toolWebhookToolModule: ProviderModule = {
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
  mock: toolWebhookMock,
};

export * from './tool-webhook.adapter';
export * from './tool-webhook.mock';
export * from './tool-webhook.transformer';
export * from './types';
export default toolWebhookToolModule;
