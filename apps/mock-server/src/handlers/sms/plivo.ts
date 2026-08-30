import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class PlivoMockHandler implements ProviderMockHandler {
  readonly id = 'plivo';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4014;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('plivo.com') || url.pathname.includes('/Message/');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Basic ') ? 'Plivo AuthId/AuthToken (Valid)' : 'None / Missing';

    let body: { src?: string; dst?: string; text?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = body.dst || 'unknown';
    const from = body.src || 'unknown';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 202,
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
        api_id: generateProviderId('plivo'),
        message: 'message(s) queued',
        message_uuid: [messageId],
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const plivoMockHandler = new PlivoMockHandler();
