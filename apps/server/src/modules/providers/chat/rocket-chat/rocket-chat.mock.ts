import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class RocketChatMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('rocket.chat') || lower.includes('rocketchat') || lower.includes('/api/v1/chat.postmessage');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        message: {
          _id: providerMessageId,
          rid: 'GENERAL',
          msg: 'RocketChat message content',
          ts: new Date().toISOString(),
          u: { _id: 'bot_id', username: 'convey' },
        },
        success: true,
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
        _id: providerMessageId,
        channel_id: recipient,
        event: eventType,
        timestamp: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const rocketChatMock = new RocketChatMockHandler();
