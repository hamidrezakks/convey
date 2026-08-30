import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class SendGridMockHandler implements ProviderMockHandler {
  readonly id = 'sendgrid';
  readonly channel = 'email' as const;
  readonly defaultPort = 4002;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('sendgrid.com') || url.pathname.includes('/v3/mail/send');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 15)}... (Valid)`
      : 'None / Missing';

    let body: {
      personalizations?: Array<{ to: Array<{ email: string }> }>;
      from?: { email: string };
      content?: Array<{ value: string }>;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipients =
      body.personalizations?.flatMap((p) => p.to.map((t) => t.email)).join(', ') || 'unknown@example.com';
    const from = body.from?.email || 'unknown@convey.dev';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 202,
      latencyMs,
      auth: authDisplay,
      recipient: recipients,
      from,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' webhook callback in 400ms",
    });

    return new Response(null, {
      status: 202,
      headers: {
        'x-message-id': messageId,
        'x-ratelimit-limit': '600',
        'x-ratelimit-remaining': '599',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
      },
    });
  }
}

export const sendgridMockHandler = new SendGridMockHandler();
