import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class WebexMessagingMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('webex') || lower.includes('ciscospark');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vMTIz',
        text: 'Webex message content',
        created: new Date().toISOString(),
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
        id: providerMessageId,
        name: `messages.${eventType}`,
        resource: 'messages',
        event: eventType,
        data: {
          id: providerMessageId,
          roomId: recipient,
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const webexMessagingMock = new WebexMessagingMockHandler();
