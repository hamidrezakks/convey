import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class RyverMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('ryver.com') || lower.includes('ryver');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        d: {
          id: providerMessageId,
          body: 'Ryver chat message',
          createDate: new Date().toISOString(),
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        eventType,
        messageId: providerMessageId,
        workroomId: recipient,
        timestamp: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const ryverMock = new RyverMockHandler();
