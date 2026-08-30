import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class BandwidthMockHandler implements ProviderMockHandler {
  readonly id = 'bandwidth';
  readonly channel = 'sms' as const;
  readonly defaultPort = 4016;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('bandwidth.com') ||
      url.pathname.includes('/bandwidth') ||
      /\/v2\/users\/[^/]+\/messages/.test(url.pathname)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Basic ') ? 'Bandwidth API Auth (Valid)' : 'None / Missing';

    let body: { from?: string; to?: string[]; text?: string; applicationId?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = Array.isArray(body.to) ? body.to.join(', ') : 'unknown';
    const from = body.from || 'unknown';
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
        id: messageId,
        time: new Date().toISOString(),
        to: Array.isArray(body.to) ? body.to : [recipient],
        from,
        text: body.text || '',
        applicationId: body.applicationId || 'app-mock-id',
        media: [],
        owner: 'convey-mock-user',
        direction: 'outbound',
        segmentCount: 1,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const bandwidthMockHandler = new BandwidthMockHandler();
