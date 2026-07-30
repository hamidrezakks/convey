import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SinchMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('sinch') || lower.includes('sinch');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        to: ['+971501234567'],
        from: '+15551234567',
        body: 'Sinch SMS message',
        status: 'queued',
        created_at: new Date().toISOString(),
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'DELIVERED', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sinchMock = new SinchMockHandler();
