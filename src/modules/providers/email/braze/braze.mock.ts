import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BrazeMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('braze.com') || url.toLowerCase().includes('braze.eu');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        message: 'success',
        dispatch_id: providerMessageId,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: `users.messages.email.${_eventType}`, dispatch_id: providerMessageId, recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const brazeMock = new BrazeMockHandler();
