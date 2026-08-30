import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class BrevoMockHandler implements ProviderMockHandler {
  readonly id = 'brevo';
  readonly channel = 'email' as const;
  readonly defaultPort = 4012;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('brevo.com') || url.hostname.includes('sendinblue') || url.pathname.includes('/smtp/email')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const apiKey = req.headers.get('api-key') || req.headers.get('authorization') || '';
    const authDisplay = apiKey ? 'Brevo API Key (Valid)' : 'None / Missing';

    let body: {
      sender?: { email: string };
      to?: Array<{ email: string }>;
      subject?: string;
      htmlContent?: string;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipients = body.to?.map((t) => t.email).join(', ') || 'user@example.com';
    const from = body.sender?.email || 'sender@convey.dev';
    const subject = body.subject || '';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 201,
      latencyMs,
      auth: authDisplay,
      recipient: recipients,
      from,
      subject,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' webhook callback in 400ms",
    });

    return new Response(JSON.stringify({ messageId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const brevoMockHandler = new BrevoMockHandler();
