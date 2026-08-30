import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class ApnsMockHandler implements ProviderMockHandler {
  readonly id = 'apns';
  readonly channel = 'push' as const;
  readonly defaultPort = 4017;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('push.apple.com') || url.pathname.includes('/3/device/') || url.hostname.includes('apns')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const tokenMatch = url.pathname.match(/\/3\/device\/([^/]+)/);
    const deviceToken = tokenMatch ? tokenMatch[1] : 'apns-device-token';
    const topic = req.headers.get('apns-topic') || 'com.convey.app';
    const apnsId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: url.pathname,
      status: 200,
      latencyMs,
      auth: 'Apple JWT Provider Token (Valid)',
      recipient: `Device: ${deviceToken.slice(0, 16)}...`,
      messageId: apnsId,
      payloadSummary: `Topic: ${topic}`,
      action: "Scheduled async 'delivered' APNs receipt in 400ms",
    });

    return new Response(null, {
      status: 200,
      headers: {
        'apns-id': apnsId,
      },
    });
  }
}

export const apnsMockHandler = new ApnsMockHandler();
