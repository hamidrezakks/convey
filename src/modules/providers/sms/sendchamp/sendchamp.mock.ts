import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SendchampMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('sendchamp') || lower.includes('sendchamp');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        code: 200,
        status: 'success',
        message: 'SMS sent successfully',
        data: { reference: providerMessageId, status: 'sent' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { reference: providerMessageId, status: 'delivered', phone: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sendchampMock = new SendchampMockHandler();
