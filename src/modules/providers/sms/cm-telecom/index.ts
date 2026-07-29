import type { ProviderModule } from '../../core/provider-module';
import { CmTelecomSmsAdapter } from './cm-telecom.adapter';
import { cmTelecomMock } from './cm-telecom.mock';

export const adapter = new CmTelecomSmsAdapter();

export const cmTelecomSmsModule: ProviderModule = {
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
  mock: cmTelecomMock,
};

export * from './cm-telecom.adapter';
export * from './cm-telecom.mock';
export * from './cm-telecom.transformer';
export * from './types';
export default cmTelecomSmsModule;
