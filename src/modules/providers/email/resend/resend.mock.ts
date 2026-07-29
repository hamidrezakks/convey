import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ResendMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('resend.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ id: providerMessageId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        type: `email.${_eventType}`,
        data: { email_id: providerMessageId, to: [recipient], created_at: new Date().toISOString() },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const resendMock = new ResendMockHandler();
