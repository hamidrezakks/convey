import { generateProviderId } from '../../core/id-generator';
import { mockLogger } from '../../core/logger';
import type { ProviderMockHandler } from '../../core/types';

export class DiscordMockHandler implements ProviderMockHandler {
  readonly id = 'discord';
  readonly channel = 'chat' as const;
  readonly defaultPort = 4009;

  matchesRequest(_req: Request, url: URL): boolean {
    return url.hostname.includes('discord.com') || url.pathname.includes('/webhooks/');
  }

  async handle(req: Request): Promise<Response> {
    const start = performance.now();
    let body: { content?: string; username?: string; embeds?: unknown[] } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty
    }

    const text = body.content || '';
    const username = body.username || 'Convey';
    const messageId = generateProviderId(this.id);
    const latencyMs = performance.now() - start;

    mockLogger.logRequest({
      providerId: this.id,
      method: req.method,
      url: new URL(req.url).pathname,
      status: 200,
      latencyMs,
      auth: 'Discord Webhook Token (Valid)',
      from: username,
      payloadSummary: `Content: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
      messageId,
      action: "Scheduled async 'delivered' callback in 400ms",
    });

    return new Response(
      JSON.stringify({
        id: messageId,
        type: 0,
        content: text,
        channel_id: '123456789012345678',
        author: {
          id: '987654321098765432',
          username,
          avatar: null,
          discriminator: '0000',
          bot: true,
        },
        attachments: [],
        embeds: body.embeds || [],
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export const discordMockHandler = new DiscordMockHandler();
