import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class GenericEmailMockHandler implements ProviderMockHandler {
  readonly id: string;
  readonly channel = 'email' as const;
  readonly domains: string[];
  readonly paths: string[];

  constructor(id: string, domains: string[] = [], paths: string[] = []) {
    this.id = id;
    this.domains = [id, ...domains];
    this.paths = paths;
  }

  matchesRequest(_req: Request, url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      this.domains.some((d) => host.includes(d.toLowerCase())) ||
      this.paths.some((p) => path === p || path.startsWith(`${p}/`)) ||
      path.includes(this.id)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || req.headers.get('api-key') || '';
    const authDisplay = authHeader ? 'API Credentials (Valid)' : 'None / Missing';

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // empty
    }

    const recipient = String(body.to || body.recipient || body.email || 'user@example.com');
    const from = String(body.from || body.sender || 'sender@convey.dev');
    const subject = String(body.subject || '');
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient,
      from,
      subject,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' webhook callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        id: messageId,
        messageId,
        status: 'success',
        provider: this.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const otherEmailHandlers: Record<string, ProviderMockHandler> = {
  mailtrap: new GenericEmailMockHandler('mailtrap', ['mailtrap.io'], ['/api/send']),
  plunk: new GenericEmailMockHandler('plunk', ['useplunk.com'], ['/v1/send']),
  sparkpost: new GenericEmailMockHandler('sparkpost', ['sparkpost.com'], ['/api/v1/transmissions']),
  mailjet: new GenericEmailMockHandler('mailjet', ['mailjet.com'], ['/v3.1/send']),
  mandrill: new GenericEmailMockHandler('mandrill', ['mandrillapp.com'], ['/api/1.0/messages/send']),
  emailjs: new GenericEmailMockHandler('emailjs', ['emailjs.com'], ['/api/v1.0/email/send']),
  mailersend: new GenericEmailMockHandler('mailersend', ['mailersend.com'], ['/v1/email']),
  netcore: new GenericEmailMockHandler('netcore', ['netcorecloud.net'], ['/v5/mail/send']),
  anypost: new GenericEmailMockHandler('anypost', ['anypost.io'], ['/v1/email/send']),
  braze: new GenericEmailMockHandler('braze', ['braze.com'], ['/messages/send']),
  outlook365: new GenericEmailMockHandler('outlook365', ['graph.microsoft.com'], ['/sendMail']),
  nodemailer: new GenericEmailMockHandler('nodemailer', ['smtp'], ['/smtp']),
  'email-webhook': new GenericEmailMockHandler('email-webhook', ['webhook'], ['/webhook']),
  infobip: new GenericEmailMockHandler('infobip', ['infobip.com'], ['/email/1/send']),
};
