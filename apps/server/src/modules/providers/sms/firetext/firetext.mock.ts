import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class FiretextMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('firetext') || lower.includes('firetext');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        code: 0,
        description: '1 SMS credit(s) used',
        mobile: '+971501234567',
        reference: providerMessageId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { reference: providerMessageId, status: 'DELIVERED', mobile: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const firetextMock = new FiretextMockHandler();
