import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ChatWebhookMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('chat-webhook') || lower.includes('webhook.chat');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: true,
        messageId: providerMessageId,
        deliveredAt: new Date().toISOString(),
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
        event: `chat.${eventType}`,
        messageId: providerMessageId,
        channel: recipient,
        timestamp: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const chatWebhookMock = new ChatWebhookMockHandler();
