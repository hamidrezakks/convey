import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class TwilioWhatsappMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('twilio') && (lower.includes('whatsapp') || lower.includes('chat'));
  }

  buildResponse({
    url,
    method: _method,
    body,
    headers: _headers,
    providerMessageId,
  }: ProviderMockResponseParams): Response {
    let toPhone = '+971501234567';
    if (body && typeof (body as { get?: (k: string) => string | null }).get === 'function') {
      const val = (body as { get: (k: string) => string | null }).get('To');
      if (val) toPhone = val.replace(/\s+/g, '+');
    } else if (typeof body === 'string') {
      const params = new URLSearchParams(body);
      const val = params.get('To');
      if (val) toPhone = val.replace(/\s+/g, '+');
    } else if (body && typeof body === 'object' && 'To' in (body as Record<string, unknown>)) {
      toPhone = String((body as Record<string, unknown>).To);
    }

    const isWhatsapp = url.includes('whatsapp') || toPhone.includes('whatsapp');
    const formattedTo = toPhone.startsWith('whatsapp:') ? toPhone : isWhatsapp ? `whatsapp:${toPhone}` : toPhone;

    return new Response(
      JSON.stringify({
        sid: providerMessageId,
        date_created: new Date().toUTCString(),
        date_updated: new Date().toUTCString(),
        account_sid: 'AC1234567890abcdef1234567890abcdef',
        to: formattedTo,
        from: isWhatsapp ? 'whatsapp:+14155238886' : '+14155238886',
        body: typeof body === 'string' ? body : 'Twilio message',
        status: 'queued',
        num_segments: '1',
        price: null,
        price_unit: 'USD',
        uri: `/2010-04-01/Accounts/AC12345/Messages/${providerMessageId}.json`,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    const twilioStatus =
      eventType === 'delivered'
        ? 'delivered'
        : eventType === 'failed'
          ? 'failed'
          : eventType === 'read'
            ? 'read'
            : 'sent';
    const formattedTo = recipient.startsWith('whatsapp:') ? recipient : `whatsapp:${recipient}`;

    return {
      payload: {
        SmsSid: providerMessageId,
        MessageSid: providerMessageId,
        AccountSid: 'AC1234567890abcdef1234567890abcdef',
        From: 'whatsapp:+14155238886',
        To: formattedTo,
        MessageStatus: twilioStatus,
        Body: 'Twilio WhatsApp webhook message',
        ApiVersion: '2010-04-01',
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'mock_twilio_signature',
      },
    };
  }
}

export const twilioWhatsappMock = new TwilioWhatsappMockHandler();
