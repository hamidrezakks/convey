import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class AppioMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('appio');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ success: true, messageId: providerMessageId, status: 'sent' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'delivered', deviceToken: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const appioMock = new AppioMockHandler();
