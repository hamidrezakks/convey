import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class EmailjsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('emailjs.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ status: 200, text: 'OK', messageId: providerMessageId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { status: _eventType, messageId: providerMessageId, recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const emailjsMock = new EmailjsMockHandler();
