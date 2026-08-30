import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class InfobipSmsMockHandler implements ProviderMockHandler {
  readonly id = 'infobip';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4013;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('infobip.com') && (url.pathname.includes('/sms/') || url.pathname.includes('/text/'));
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('App ') ? 'Infobip App Key (Valid)' : 'None / Missing';

    let body: {
      messages?: Array<{
        destinations?: Array<{ to: string }>;
        from?: string;
        text?: string;
      }>;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const firstMsg = body.messages?.[0];
    const recipient = firstMsg?.destinations?.map((d) => d.to).join(', ') || 'unknown';
    const from = firstMsg?.from || 'Convey';
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
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' DLR callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        bulkId: generateProviderId('infobip'),
        messages: [
          {
            messageId,
            to: recipient,
            status: {
              groupId: 1,
              groupName: 'PENDING',
              id: 7,
              name: 'PENDING_ENROUTE',
              description: 'Message sent to next instance',
            },
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

export const infobipSmsMockHandler = new InfobipSmsMockHandler();
