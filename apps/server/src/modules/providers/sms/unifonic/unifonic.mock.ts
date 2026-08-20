import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class UnifonicMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('unifonic') || lower.includes('unifonic');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: 'true',
        message: 'Queued',
        data: { MessageID: providerMessageId, Status: 'Queued', NumberOfUnits: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { MessageID: providerMessageId, Status: 'Delivered', Recipient: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const unifonicMock = new UnifonicMockHandler();
