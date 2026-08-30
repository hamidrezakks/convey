import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';
import { scheduleWebhookCallback } from '../../core/webhook-client';

export class CequensSmsMockHandler implements ProviderMockHandler {
  readonly id = 'cequens';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4048;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('cequens.com') ||
      url.pathname.includes('/api/sms/v1/messages') ||
      url.pathname.includes('/cequens')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 17)}... (Valid Cequens API Key)`
      : 'None / Missing';

    let body: { recipient?: string; message?: string; senderName?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // ignore
    }

    const messageId = generateProviderId('cequens');
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      recipient: body.recipient || 'Unknown',
      from: body.senderName || 'Convey',
      messageId,
      authSummary: authDisplay,
      payloadSummary: `Body: "${(body.message || '').slice(0, 30)}"`,
      action: "Scheduled async 'delivered' DLR callback in 400ms",
    });

    scheduleWebhookCallback(this.id, {
      eventType: 'delivered',
      messageId,
      recipient: body.recipient || '+15550192834',
    });

    return new Response(
      JSON.stringify({
        replyCode: 0,
        replyMessage: 'Success',
        data: {
          messageId,
          recipient: body.recipient,
          sentTimestamp: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
