import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class GenericToolMockHandler implements ProviderMockHandler {
  readonly id: string;
  readonly channel = 'tool' as const;
  readonly domains: string[];
  readonly paths: string[];

  constructor(id: string, domains: string[] = [], paths: string[] = []) {
    this.id = id;
    this.domains = [id, ...domains];
    this.paths = paths;
  }

  matchesRequest(_req: Request, url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      this.domains.some((d) => host.includes(d.toLowerCase())) ||
      this.paths.some((p) => path.includes(p.toLowerCase())) ||
      path.includes(this.id)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // empty
    }

    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: 'Processed tool event',
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        result: 'Request Will Be Processed',
        requestId: messageId,
        id: messageId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const otherToolHandlers: Record<string, ProviderMockHandler> = {
  opsgenie: new GenericToolMockHandler('opsgenie', ['opsgenie.com'], ['/alerts']),
  grafana: new GenericToolMockHandler('grafana', ['grafana.net'], ['/alerts']),
  'tool-webhook': new GenericToolMockHandler('tool-webhook', ['webhook'], ['/tool/webhook']),
};
