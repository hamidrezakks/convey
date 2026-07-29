import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SesMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('email.') && url.toLowerCase().includes('amazonaws.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        MessageId: providerMessageId,
        ResponseMetadata: { RequestId: `ses_req_${Date.now()}` },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        notificationType: _eventType === 'delivered' ? 'Delivery' : 'Bounce',
        mail: { messageId: providerMessageId, destination: [recipient] },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sesMock = new SesMockHandler();
