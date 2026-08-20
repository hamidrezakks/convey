import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class OpsgenieMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('opsgenie.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({ result: 'Request processed successfully', requestId: providerMessageId, took: 0.015 }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient: _recipient }: ProviderWebhookMockParams) {
    return {
      payload: { action: 'Create', alert: { alertId: providerMessageId, status: 'open', message: 'Alert message' } },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const opsgenieMock = new OpsgenieMockHandler();
