import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class PagerDutyMockHandler implements ProviderMockHandler {
  readonly id = 'pagerduty';
  readonly channel = 'tool' as const;
  readonly defaultPort = 4005;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('pagerduty.com') || url.pathname.includes('/v2/enqueue');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    let body: { routing_key?: string; event_action?: string; payload?: { summary?: string; severity?: string } } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const dedupKey = generateProviderId(this.id);
    const summary = body.payload?.summary || 'Alert';
    const severity = body.payload?.severity || 'error';
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 202,
      latencyMs,
      auth: `Routing Key: ${body.routing_key ? `${body.routing_key.slice(0, 10)}... (Valid)` : 'Missing'}`,
      payloadSummary: `Action: ${body.event_action} | Severity: ${severity} | Summary: "${summary}"`,
      messageId: dedupKey,
      action: 'Event queued in PagerDuty incident pipeline',
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Event processed',
        dedup_key: dedupKey,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const pagerdutyMockHandler = new PagerDutyMockHandler();
