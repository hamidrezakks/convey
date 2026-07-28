import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PostmarkMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('postmarkapp.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        To: 'test@example.com',
        SubmittedAt: new Date().toISOString(),
        MessageID: providerMessageId,
        ErrorCode: 0,
        Message: 'OK',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        RecordType: _eventType === 'delivered' ? 'Delivery' : 'Bounce',
        MessageID: providerMessageId,
        Recipient: recipient,
        DeliveredAt: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const postmarkMock = new PostmarkMockHandler();
