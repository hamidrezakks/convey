import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class NexmoMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('nexmo') || lower.includes('nexmo');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        'message-count': '1',
        messages: [
          {
            to: '+971501234567',
            'message-id': providerMessageId,
            status: '0',
            'remaining-balance': '10.00',
            'message-price': '0.033',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'delivered', msisdn: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const nexmoMock = new NexmoMockHandler();
