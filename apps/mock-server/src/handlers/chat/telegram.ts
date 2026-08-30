import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class TelegramMockHandler implements ProviderMockHandler {
  readonly id = 'telegram';
  readonly channel = 'chat' as const;
  readonly defaultPort = 4010;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('telegram.org') || url.pathname.includes('/sendMessage');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const botToken = url.pathname.match(/\/bot([^/]+)/)?.[1] || 'mock_bot_token';

    let body: { chat_id?: string | number; text?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const chatId = String(body.chat_id || 'unknown');
    const text = body.text || '';
    const messageId = Number(generateProviderId(this.id));
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: url.pathname,
      status: 200,
      latencyMs,
      auth: `Bot Token: ${botToken.slice(0, 8)}... (Valid)`,
      recipient: `Chat: ${chatId}`,
      payloadSummary: `Text: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
      messageId: String(messageId),
      action: "Scheduled async 'delivered' callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: messageId,
          from: { id: 123456789, is_bot: true, first_name: 'ConveyBot', username: 'convey_bot' },
          chat: { id: Number(chatId) || 987654, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const telegramMockHandler = new TelegramMockHandler();
