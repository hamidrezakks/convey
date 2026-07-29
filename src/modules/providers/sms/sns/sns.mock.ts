import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SnsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('sns') || lower.includes('sns');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        MessageId: providerMessageId,
        ResponseMetadata: { RequestId: `sns_req_${Date.now()}` },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { MessageId: providerMessageId, Status: 'SUCCESS', Destination: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const snsMock = new SnsMockHandler();
