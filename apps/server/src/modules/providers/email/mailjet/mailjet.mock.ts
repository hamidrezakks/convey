import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MailjetMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('mailjet.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        Messages: [
          {
            Status: 'success',
            CustomID: providerMessageId,
            To: [{ Email: 'test@example.com', MessageUUID: providerMessageId, MessageID: 998877 }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        event: _eventType === 'delivered' ? 'sent' : 'bounce',
        MessageID: 998877,
        CustomID: providerMessageId,
        email: recipient,
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const mailjetMock = new MailjetMockHandler();
