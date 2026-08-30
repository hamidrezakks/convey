import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class SlackMockHandler implements ProviderMockHandler {
  readonly id = 'slack';
  readonly channel = 'chat' as const;
  readonly defaultPort = 4003;

  matchesRequest(_req: Request, url: URL): boolean {
    return (
      url.hostname.includes('slack.com') ||
      url.pathname.includes('/chat.postMessage') ||
      url.pathname.includes('/api/chat')
    );
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const authHeader = req.headers.get('authorization') || '';
    const authDisplay = authHeader.startsWith('Bearer ')
      ? `Bearer ${authHeader.slice(7, 15)}... (Valid Bot Token)`
      : 'None / Missing';

    let body: { channel?: string; text?: string; blocks?: unknown[] } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const channel = body.channel || 'general';
    const text = body.text || '';
    const ts = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: authDisplay,
      recipient: `#${channel}`,
      payloadSummary: `Text: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
      messageId: ts,
      action: "Scheduled async 'read' interaction callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        channel,
        ts,
        message: {
          text,
          user: 'U_MOCK_BOT',
          type: 'message',
          subtype: 'bot_message',
          ts,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const slackMockHandler = new SlackMockHandler();
