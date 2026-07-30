import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SimpletextingMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('simpletexting') || lower.includes('simpletexting');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        status: 'SENT',
        phone: '+971501234567',
        text: 'SMS text',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'DELIVERED', phone: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const simpletextingMock = new SimpletextingMockHandler();
