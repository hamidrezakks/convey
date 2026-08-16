import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class InfobipMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('infobip') || lower.includes('infobip');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        messages: [
          {
            to: '+971501234567',
            status: { id: 1, groupId: 1, name: 'PENDING', description: 'Message sent' },
            messageId: providerMessageId,
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        results: [{ messageId: providerMessageId, status: { name: eventType.toUpperCase() }, to: recipient }],
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const infobipMock = new InfobipMockHandler();
