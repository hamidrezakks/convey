import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class RuachSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('ruach-sms') || lower.includes('ruachsms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: 'SUCCESS',
        message_id: providerMessageId,
        code: 200,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { message_id: providerMessageId, status: 'DELIVERED', phone: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const ruachSmsMock = new RuachSmsMockHandler();
