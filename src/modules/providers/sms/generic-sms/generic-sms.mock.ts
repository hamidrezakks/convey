import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class GenericSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('generic-sms') || lower.includes('genericsms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: true,
        messageId: providerMessageId,
        status: 'delivered',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'DELIVERED', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const genericSmsMock = new GenericSmsMockHandler();
