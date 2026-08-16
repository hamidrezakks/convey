import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PlivoMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('plivo') || lower.includes('plivo');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        message: 'message(s) queued',
        message_uuid: [providerMessageId],
        api_id: `plivo_api_${Date.now()}`,
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { MessageUUID: providerMessageId, Status: 'delivered', To: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const plivoMock = new PlivoMockHandler();
