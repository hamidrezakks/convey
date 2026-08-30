import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class ResendMockHandler implements ProviderMockHandler {
  readonly id = 'resend';
  readonly channel = 'email' as const;
  readonly defaultPort = 4001;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('resend.com') ||
      url.pathname === '/emails' ||
      url.pathname === '/v1/emails' ||
      url.pathname.startsWith('/emails')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 15)}... (Valid)`
      : 'None / Missing';

    let body: { from?: string; to?: string | string[]; subject?: string; html?: string; text?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty or non-json
    }

    const recipient = Array.isArray(body.to) ? body.to.join(', ') : body.to || '';
    const from = body.from || '';
    const subject = body.subject || '';

    // Official Resend validation: 'to' and 'from' are required
    if (!recipient) {
      const latencyMs = performance.now() - start;
      mockLogger.logRequest({
        providerId: this.id,
        method: req.method,
        url: new URL(req.url).pathname,
        status: 422,
        latencyMs,
        auth: authDisplay,
        error: 'Missing required field: to',
      });

      return new Response(
        JSON.stringify({
          statusCode: 422,
          message: 'The to parameter is required',
          name: 'validation_error',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

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

    return new Response(JSON.stringify({ id: messageId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-resend-request-id': generateProviderId('resend'),
        'x-ratelimit-limit': '100',
        'x-ratelimit-remaining': '99',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
      },
    });
  }
}

export const resendMockHandler = new ResendMockHandler();
