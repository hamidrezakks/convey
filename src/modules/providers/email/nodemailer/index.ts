import type { ProviderModule } from '../../core/provider-module';
import { NodemailerEmailAdapter } from './nodemailer.adapter';
import { nodemailerMock } from './nodemailer.mock';

export const adapter = new NodemailerEmailAdapter();

export const nodemailerEmailModule: ProviderModule = {
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
  mock: nodemailerMock,
};

export * from './nodemailer.adapter';
export * from './nodemailer.mock';
export * from './nodemailer.transformer';
export * from './types';
export default nodemailerEmailModule;
