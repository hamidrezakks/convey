import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class LineMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('line.me') || lower.includes('line-apps.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        sentMessages: [
          {
            id: providerMessageId,
            quoteToken: 'quote_token_123',
          },
        ],
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
        events: [
          {
            type: 'message',
            message: {
              id: providerMessageId,
              type: 'text',
              text: `Line event ${eventType}`,
            },
            source: {
              userId: recipient,
              type: 'user',
            },
            timestamp: Date.now(),
          },
        ],
      },
      headers: { 'content-type': 'application/json', 'x-line-signature': 'mock_line_signature' },
    };
  }
}

export const lineMock = new LineMockHandler();
