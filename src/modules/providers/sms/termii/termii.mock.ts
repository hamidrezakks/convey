import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class TermiiMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('termii') || lower.includes('termii');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        message_id: providerMessageId,
        message: 'Successfully Sent',
        balance: 500,
        user: 'testuser',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { message_id: providerMessageId, status: 'delivered', receiver: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const termiiMock = new TermiiMockHandler();
