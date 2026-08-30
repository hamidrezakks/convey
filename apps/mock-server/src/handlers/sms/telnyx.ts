import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class TelnyxMockHandler implements ProviderMockHandler {
  readonly id = 'telnyx';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4015;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('telnyx.com') || url.pathname.includes('/v2/messages');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ') ? 'Telnyx Bearer Key (Valid)' : 'None / Missing';

    let body: { from?: string; to?: string; text?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = body.to || 'unknown';
    const from = body.from || 'unknown';
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
      messageId,
      payloadSummary: `Body: "${body.text || ''}"`,
      action: "Scheduled async 'delivered' DLR callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        data: {
          id: messageId,
          record_type: 'message',
          direction: 'outbound',
          messaging_profile_id: generateProviderId('telnyx'),
          from: { phone_number: from, carrier: 'Telnyx' },
          to: [{ phone_number: recipient, status: 'queued' }],
          text: body.text || '',
          valid_until: new Date(Date.now() + 86400000).toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const telnyxMockHandler = new TelnyxMockHandler();
