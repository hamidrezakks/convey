import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class TelegramMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('telegram.org');
  }

  buildResponse({ providerMessageId: _providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 998811,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 123456, type: 'private', first_name: 'Test' },
          text: 'Telegram message content',
        },
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
        update_id: 1000200,
        message: {
          message_id: providerMessageId,
          date: Math.floor(Date.now() / 1000),
          chat: { id: recipient, type: 'private' },
          text: `Telegram update ${eventType}`,
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const telegramMock = new TelegramMockHandler();
