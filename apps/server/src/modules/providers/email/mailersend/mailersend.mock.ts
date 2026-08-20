import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MailersendMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('mailersend.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(null, {
      status: 202,
      headers: {
        'x-message-id': providerMessageId,
        'content-type': 'text/plain',
      },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        type: `activity.${_eventType}`,
        data: { email: { id: providerMessageId, recipient: { email: recipient } } },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const mailersendMock = new MailersendMockHandler();
