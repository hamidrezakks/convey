import type { ProviderMockHandler } from '../../core/types';
import { brevoMockHandler } from './brevo';
import { mailgunMockHandler } from './mailgun';
import { otherEmailHandlers } from './other-email';
import { postmarkMockHandler } from './postmark';
import { resendMockHandler } from './resend';
import { sendgridMockHandler } from './sendgrid';
import { sesMockHandler } from './ses';

export const emailHandlers: Record<string, ProviderMockHandler> = {
  resend: resendMockHandler,
  sendgrid: sendgridMockHandler,
  ses: sesMockHandler,
  mailgun: mailgunMockHandler,
  postmark: postmarkMockHandler,
  brevo: brevoMockHandler,
  ...otherEmailHandlers,
};

export function findEmailHandler(req: Request, url: URL): ProviderMockHandler | undefined {
  for (const handler of Object.values(emailHandlers)) {
    if (handler.matchesRequest(req, url)) {
      return handler;
    }
  }
  return undefined;
}
