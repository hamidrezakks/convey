import type { ProviderMockHandler } from '../../core/types';
import { discordMockHandler } from './discord';
import { otherChatHandlers } from './other-chat';
import { slackMockHandler } from './slack';
import { telegramMockHandler } from './telegram';

export const chatHandlers: Record<string, ProviderMockHandler> = {
  slack: slackMockHandler,
  telegram: telegramMockHandler,
  discord: discordMockHandler,
  ...otherChatHandlers,
};

export function findChatHandler(req: Request, url: URL): ProviderMockHandler | undefined {
  for (const handler of Object.values(chatHandlers)) {
    if (handler.matchesRequest(req, url)) {
      return handler;
    }
  }
  return undefined;
}
