import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MailgunMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return (
      url.toLowerCase().includes('mailgun.net') ||
      url.toLowerCase().includes('mailgun.org') ||
      url.toLowerCase().includes('mailgun.com')
    );
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: `<${providerMessageId}@mailgun.org>`,
        message: 'Queued. Thank you.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        'event-data': {
          event: _eventType,
          recipient,
          message: { headers: { 'message-id': providerMessageId } },
          timestamp: Math.floor(Date.now() / 1000),
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const mailgunMock = new MailgunMockHandler();
