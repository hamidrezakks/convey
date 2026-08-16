import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BurstSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('burst-sms') || lower.includes('burstsms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: 'OK',
        message_id: providerMessageId,
        cost: 0.05,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { message_id: providerMessageId, status: 'DELIVERED', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const burstSmsMock = new BurstSmsMockHandler();
