import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class MailgunMockHandler implements ProviderMockHandler {
  readonly id = 'mailgun';
  readonly channel = 'email' as const;
  readonly defaultPort = 4008;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('mailgun.net') || url.pathname.includes('/messages');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Basic ') ? 'Basic Auth (api:key-***) (Valid)' : 'None / Missing';

    let body: { from?: string; to?: string; subject?: string; text?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // urlencoded fallback
    }

    const recipient = body.to || 'user@example.com';
    const from = body.from || 'mailgun@convey.mock';
    const subject = body.subject || '';
    const messageId = generateProviderId(this.id, { domain: 'convey.mock' });
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
        message: 'Queued. Thank you.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const mailgunMockHandler = new MailgunMockHandler();
