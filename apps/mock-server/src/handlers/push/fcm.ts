import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class FcmMockHandler implements ProviderMockHandler {
  readonly id = 'fcm';
  readonly channel = 'push' as const;
  readonly defaultPort = 4004;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('fcm.googleapis.com') ||
      url.pathname.includes('/messages:send') ||
      url.pathname.includes('/fcm/send')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader ? 'Google OAuth2 Token (Valid)' : 'None / Missing';

    const url = new URL(req.url);
    const projectMatch = url.pathname.match(/\/projects\/([^/]+)/);
    const projectId = projectMatch ? projectMatch[1] : 'convey-test-project';

    let body: { message?: { token?: string; topic?: string; notification?: { title?: string } } } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const recipient = body.message?.token || body.message?.topic || 'fcm-device-token';
    const messageId = generateProviderId(this.id, { projectId });
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: url.pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient: `Token: ${recipient.slice(0, 20)}...`,
      messageId,
      payloadSummary: `Title: "${body.message?.notification?.title || ''}"`,
      action: "Scheduled async 'delivered' push receipt in 400ms",
    });

    return new Response(JSON.stringify({ name: messageId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const fcmMockHandler = new FcmMockHandler();
