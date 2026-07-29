import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MessagebirdMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('messagebird') || lower.includes('messagebird');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        href: `https://rest.messagebird.com/messages/${providerMessageId}`,
        direction: 'outbound',
        type: 'sms',
        originator: 'Convey',
        recipients: {
          totalCount: 1,
          totalSentCount: 1,
          items: [{ recipient: 971501234567, status: 'sent' }],
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'delivered', recipient: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const messagebirdMock = new MessagebirdMockHandler();
