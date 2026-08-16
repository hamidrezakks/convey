import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BrevoMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return (
      (url.toLowerCase().includes('brevo.com') || url.toLowerCase().includes('sendinblue.com')) &&
      !url.toLowerCase().includes('sms')
    );
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ messageId: `<${providerMessageId}@brevo.com>` }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: _eventType, 'message-id': providerMessageId, email: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const brevoMock = new BrevoMockHandler();
