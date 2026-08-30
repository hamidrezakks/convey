import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class PostmarkMockHandler implements ProviderMockHandler {
  readonly id = 'postmark';
  readonly channel = 'email' as const;
  readonly defaultPort = 4011;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('postmarkapp.com') || url.pathname === '/email';
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const token = req.headers.get('x-postmark-server-token') || req.headers.get('authorization') || '';
    const authDisplay = token ? 'Postmark Server Token (Valid)' : 'None / Missing';

    let body: { From?: string; To?: string; Subject?: string; TextBody?: string; HtmlBody?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = body.To || 'user@example.com';
    const from = body.From || 'sender@convey.dev';
    const subject = body.Subject || '';
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
        To: recipient,
        SubmittedAt: new Date().toISOString(),
        MessageID: messageId,
        ErrorCode: 0,
        Message: 'OK',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const postmarkMockHandler = new PostmarkMockHandler();
