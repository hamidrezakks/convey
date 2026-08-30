import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class WhatsappBusinessMockHandler implements ProviderMockHandler {
  readonly id = 'whatsapp-business';
  readonly channel = 'chat' as const;
  readonly defaultPort = 4019;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('graph.facebook.com') ||
      url.pathname.includes('/whatsapp-business') ||
      /\/v\d+\.\d+\/\d+\/messages/.test(url.pathname)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 17)}... (Valid Meta Token)`
      : 'None / Missing';

    let body: {
      messaging_product?: string;
      to?: string;
      type?: string;
      text?: { body?: string };
      template?: { name?: string };
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = body.to || '15550192834';
    const text = body.text?.body || body.template?.name || 'WhatsApp Notification';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient: `+${recipient.replace(/\D/g, '')}`,
      payloadSummary: `Type: ${body.type || 'text'} | "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
      messageId,
      action: "Scheduled async 'delivered' and 'read' receipts in 400ms",
    });

    return new Response(
      JSON.stringify({
        messaging_product: 'whatsapp',
        contacts: [
          {
            input: recipient,
            wa_id: recipient.replace(/\D/g, ''),
          },
        ],
        messages: [
          {
            id: messageId,
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const whatsappBusinessMockHandler = new WhatsappBusinessMockHandler();
