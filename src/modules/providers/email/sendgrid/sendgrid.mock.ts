import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SendgridMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('sendgrid.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(null, {
      status: 202,
      headers: {
        'x-message-id': providerMessageId,
        'content-type': 'text/plain',
      },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: [
        {
          email: recipient,
          event: _eventType === 'delivered' ? 'delivered' : 'bounce',
          sg_message_id: providerMessageId,
          timestamp: Math.floor(Date.now() / 1000),
        },
      ],
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sendgridMock = new SendgridMockHandler();
