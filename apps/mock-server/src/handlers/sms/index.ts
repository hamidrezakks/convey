import type { ProviderMockHandler } from '../../core/types';
import { bandwidthMockHandler } from './bandwidth';
import { infobipSmsMockHandler } from './infobip';
import { otherSmsHandlers } from './other-sms';
import { plivoMockHandler } from './plivo';
import { telnyxMockHandler } from './telnyx';
import { twilioMockHandler } from './twilio';

export const smsHandlers: Record<string, ProviderMockHandler> = {
  twilio: twilioMockHandler,
  infobip: infobipSmsMockHandler,
  plivo: plivoMockHandler,
  telnyx: telnyxMockHandler,
  bandwidth: bandwidthMockHandler,
  ...otherSmsHandlers,
};

export function findSmsHandler(req: Request, url: URL): ProviderMockHandler | undefined {
  for (const handler of Object.values(smsHandlers)) {
    if (handler.matchesRequest(req, url)) {
      return handler;
    }
  }
  return undefined;
}
