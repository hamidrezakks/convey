import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class WhatsappBusinessMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('graph.facebook.com') && (lower.includes('messages') || lower.includes('whatsapp'));
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        messaging_product: 'whatsapp',
        contacts: [{ input: '+971501234567', wa_id: '971501234567' }],
        messages: [{ id: providerMessageId, message_status: 'accepted' }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    const status =
      eventType === 'delivered'
        ? 'delivered'
        : eventType === 'read'
          ? 'read'
          : eventType === 'failed'
            ? 'failed'
            : 'sent';
    return {
      payload: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '15550001111', phone_number_id: '999888' },
                  statuses: [
                    {
                      id: providerMessageId,
                      status,
                      timestamp: Math.floor(Date.now() / 1000),
                      recipient_id: recipient,
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      },
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'mock_whatsapp_hub_signature' },
    };
  }
}

export const whatsappBusinessMock = new WhatsappBusinessMockHandler();
