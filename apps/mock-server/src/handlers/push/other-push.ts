import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class GenericPushMockHandler implements ProviderMockHandler {
  readonly id: string;
  readonly channel = 'push' as const;
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
      this.paths.some((p) => path === p || path.startsWith(`${p}/`)) ||
      path.includes(this.id)
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader ? 'Push Token/Key (Valid)' : 'None / Missing';

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
      auth: authDisplay,
      messageId,
      payloadSummary: `${JSON.stringify(body).length} bytes`,
      action: "Scheduled async 'delivered' push receipt in 400ms",
    });

    return new Response(
      JSON.stringify({
        id: messageId,
        messageId,
        status: 'ok',
        data: [{ status: 'ok', id: messageId }],
        recipients: 1,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const otherPushHandlers: Record<string, ProviderMockHandler> = {
  expo: new GenericPushMockHandler('expo', ['exp.host'], ['/push/send']),
  'one-signal': new GenericPushMockHandler('one-signal', ['onesignal.com'], ['/notifications']),
  'pusher-beams': new GenericPushMockHandler('pusher-beams', ['pushnotifications.pusher.com'], ['/publishes']),
  pushpad: new GenericPushMockHandler('pushpad', ['pushpad.xyz'], ['/notifications']),
  appio: new GenericPushMockHandler('appio', ['appio.io'], ['/push/send']),
  'push-webhook': new GenericPushMockHandler('push-webhook', ['webhook'], ['/push/webhook']),
};
