import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class Sms77MockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('sms77') || lower.includes('sms77');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: '100',
        total_price: 0.075,
        balance: 25.5,
        messages: [{ id: providerMessageId, sender: 'Convey', recipient: '+971501234567', success: true }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'delivered', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sms77Mock = new Sms77MockHandler();
