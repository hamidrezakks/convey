import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class IsendproSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('isendpro-sms') || lower.includes('isendprosms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        state: { response: [{ messageId: providerMessageId, status: 0, to: '+971501234567' }] },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'DELIVERED', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const isendproSmsMock = new IsendproSmsMockHandler();
