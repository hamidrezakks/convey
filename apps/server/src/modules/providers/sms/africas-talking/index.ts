import type { ProviderModule } from '../../core/provider-module';
import { AfricasTalkingSmsAdapter } from './africas-talking.adapter';
import { africasTalkingMock } from './africas-talking.mock';

export const adapter = new AfricasTalkingSmsAdapter();

export const africasTalkingSmsModule: ProviderModule = {
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
  mock: africasTalkingMock,
};

export * from './africas-talking.adapter';
export * from './africas-talking.mock';
export * from './africas-talking.transformer';
export * from './types';
export default africasTalkingSmsModule;
