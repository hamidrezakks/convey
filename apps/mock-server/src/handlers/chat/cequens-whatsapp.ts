import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';
import { scheduleWebhookCallback } from '../../core/webhook-client';

export class CequensWhatsappMockHandler implements ProviderMockHandler {
  readonly id = 'cequens-whatsapp';
  readonly channel = 'chat' as const;
  readonly defaultPort = 4021;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('apis.cequens.com') ||
      url.pathname.includes('/whatsapp/v1/messages') ||
      url.pathname.includes('/cequens-whatsapp')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 17)}... (Valid Cequens WhatsApp Key)`
      : 'None / Missing';

    let body: { recipientPhone?: string; messageText?: string; messageType?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // ignore
    }

    const messageId = generateProviderId('cequens_wa');
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      recipient: body.recipientPhone || 'Unknown',
      messageId,
      authSummary: authDisplay,
      payloadSummary: `Type: ${body.messageType || 'text'} | Body: "${(body.messageText || '').slice(0, 30)}"`,
      action: "Scheduled async 'delivered' callback in 400ms",
    });

    scheduleWebhookCallback(this.id, {
      eventType: 'delivered',
      messageId,
      recipient: body.recipientPhone || '+15550192834',
    });

    return new Response(
      JSON.stringify({
        responseCode: 0,
        responseDescription: 'Message Queued Successfully',
        data: {
          messageId,
          recipient: body.recipientPhone,
          status: 'SENT',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
