import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ClickatellMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('clickatell') || lower.includes('clickatell');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        messages: [{ apiMessageId: providerMessageId, accepted: true, to: '971501234567', error: null }],
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { apiMessageId: providerMessageId, status: 'DELIVERED', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const clickatellMock = new ClickatellMockHandler();
