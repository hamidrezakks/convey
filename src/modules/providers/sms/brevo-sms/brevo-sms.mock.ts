import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BrevoSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('brevo-sms') || lower.includes('brevosms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        reference: providerMessageId,
        messageId: 998877,
        status: 'sent',
        smsCount: 1,
        usedCredits: 1,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'delivered', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const brevoSmsMock = new BrevoSmsMockHandler();
