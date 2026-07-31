import type { ProviderModule } from '../../core/provider-module';
import { PusherBeamsPushAdapter } from './pusher-beams.adapter';
import { pusherBeamsMock } from './pusher-beams.mock';

export const adapter = new PusherBeamsPushAdapter();

export const pusherBeamsPushModule: ProviderModule = {
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
  mock: pusherBeamsMock,
};

export * from './pusher-beams.adapter';
export * from './pusher-beams.mock';
export * from './pusher-beams.transformer';
export * from './types';
export default pusherBeamsPushModule;
