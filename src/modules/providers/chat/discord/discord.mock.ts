import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class DiscordMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('discord.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        type: 0,
        content: 'Discord message content',
        channel_id: '123456789012345678',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        id: providerMessageId,
        channel_id: recipient,
        type: 0,
        content: `Discord event ${eventType}`,
        timestamp: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const discordMock = new DiscordMockHandler();
