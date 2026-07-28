import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PlunkMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('plunk.dev');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        id: providerMessageId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: `email.${_eventType}`, email: recipient, id: providerMessageId },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const plunkMock = new PlunkMockHandler();
