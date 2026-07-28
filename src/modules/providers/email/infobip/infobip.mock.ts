import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class InfobipMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return (
      url.toLowerCase().includes('infobip.com') &&
      (url.toLowerCase().includes('email') || url.toLowerCase().includes('mail'))
    );
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        messages: [
          {
            to: 'test@example.com',
            messageId: providerMessageId,
            status: { id: 1, name: 'PENDING', description: 'Message accepted' },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        results: [{ messageId: providerMessageId, status: { name: _eventType.toUpperCase() }, to: recipient }],
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const infobipMock = new InfobipMockHandler();
