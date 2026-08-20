import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MailtrapMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('mailtrap.io') || url.toLowerCase().includes('mailtrap.live');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        success: true,
        message_ids: [providerMessageId],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: _eventType, message_id: providerMessageId, email: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const mailtrapMock = new MailtrapMockHandler();
