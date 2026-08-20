import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class TwilioMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('twilio.com') && !url.toLowerCase().includes('whatsapp');
  }

  buildResponse({ body, providerMessageId }: ProviderMockResponseParams): Response {
    let to = '+971501234567';
    if (body instanceof URLSearchParams) {
      to = body.get('To') || to;
    } else if (body && typeof body === 'object' && 'To' in (body as Record<string, unknown>)) {
      to = String((body as Record<string, unknown>).To);
    }
    return new Response(
      JSON.stringify({
        sid: providerMessageId,
        date_created: new Date().toUTCString(),
        account_sid: 'ACmockaccount123456',
        to,
        from: '+15551234567',
        body: 'Twilio SMS message',
        status: 'queued',
        uri: `/2010-04-01/Accounts/ACmockaccount123456/Messages/${providerMessageId}.json`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        MessageSid: providerMessageId,
        MessageStatus: eventType === 'delivered' ? 'delivered' : 'sent',
        To: recipient,
        From: '+15551234567',
      },
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    };
  }
}

export const twilioMock = new TwilioMockHandler();
