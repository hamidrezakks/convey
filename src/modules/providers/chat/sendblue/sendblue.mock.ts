import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SendblueMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('sendblue.co') || lower.includes('sendblue');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: 'queued',
        handle: providerMessageId,
        message_handle: providerMessageId,
        date_sent: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        event_type: `message.${eventType}`,
        handle: providerMessageId,
        number: recipient,
        status: eventType === 'delivered' ? 'DELIVERED' : 'SENT',
        date_sent: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sendblueMock = new SendblueMockHandler();
