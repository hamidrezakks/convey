import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class SesMockHandler implements ProviderMockHandler {
  readonly id = 'ses';
  readonly channel = 'email' as const;
  readonly defaultPort = 4006;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('amazonaws.com') ||
      url.hostname.includes('ses') ||
      url.pathname.includes('/v2/email/outbound-emails')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.includes('AWS4-HMAC-SHA256') ? 'AWS v4 Signature (Valid)' : 'None / Missing';

    let body: {
      Destination?: { ToAddresses?: string[] };
      FromEmailAddress?: string;
      Content?: { Simple?: { Subject?: { Data?: string } } };
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipients = body.Destination?.ToAddresses?.join(', ') || 'user@example.com';
    const from = body.FromEmailAddress || 'sender@convey.dev';
    const subject = body.Content?.Simple?.Subject?.Data || '';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient: recipients,
      from,
      subject,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' SES event callback in 400ms",
    });

    return new Response(JSON.stringify({ MessageId: messageId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-amzn-requestid': generateProviderId('ses'),
      },
    });
  }
}

export const sesMockHandler = new SesMockHandler();
