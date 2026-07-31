import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ToolWebhookMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('tool-webhook');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ success: true, messageId: providerMessageId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'delivered', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const toolWebhookMock = new ToolWebhookMockHandler();
