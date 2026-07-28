import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MandrillMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('mandrillapp.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify([
        {
          email: 'test@example.com',
          status: 'sent',
          _id: providerMessageId,
          reject_reason: null,
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: [{ event: _eventType, _id: providerMessageId, msg: { email: recipient, state: 'sent' } }],
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    };
  }
}

export const mandrillMock = new MandrillMockHandler();
