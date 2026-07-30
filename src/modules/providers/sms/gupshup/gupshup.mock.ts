import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class GupshupMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('gupshup') || lower.includes('gupshup');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: 'submitted',
        response: { id: providerMessageId, status: 'SUBMITTED' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'DELIVERED', mobile: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const gupshupMock = new GupshupMockHandler();
