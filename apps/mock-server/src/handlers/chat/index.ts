import type { ProviderMockHandler } from '../../core/types';
import { CequensWhatsappMockHandler } from './cequens-whatsapp';
import { discordMockHandler } from './discord';
import { otherChatHandlers } from './other-chat';
import { slackMockHandler } from './slack';
import { telegramMockHandler } from './telegram';
import { whatsappBusinessMockHandler } from './whatsapp-business';

export const chatHandlers: Record<string, ProviderMockHandler> = {
  slack: slackMockHandler,
  telegram: telegramMockHandler,
  discord: discordMockHandler,
  'whatsapp-business': whatsappBusinessMockHandler,
  'cequens-whatsapp': new CequensWhatsappMockHandler(),
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
