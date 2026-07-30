import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class KannelMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('kannel') || lower.includes('kannel');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: '0',
        messageId: providerMessageId,
        description: 'Accepted for delivery',
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'DELIVERED', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const kannelMock = new KannelMockHandler();
