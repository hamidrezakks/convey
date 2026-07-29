import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class AnypostMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('anypost');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: true,
        messageId: providerMessageId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: _eventType, messageId: providerMessageId, email: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const anypostMock = new AnypostMockHandler();
