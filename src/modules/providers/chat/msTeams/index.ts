import type { ProviderModule } from '../../core/provider-module';
import { MsTeamsChatAdapter } from './msTeams.adapter';
import { msTeamsMock } from './msTeams.mock';

export const adapter = new MsTeamsChatAdapter();

export const msTeamsChatModule: ProviderModule = {
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
  mock: msTeamsMock,
};

export * from './msTeams.adapter';
export * from './msTeams.mock';
export * from './msTeams.transformer';
export * from './types';
export default msTeamsChatModule;
