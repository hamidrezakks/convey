import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class GetstreamMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('stream-io-api.com') || lower.includes('getstream');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        message: {
          id: providerMessageId,
          text: 'Getstream message content',
          created_at: new Date().toISOString(),
        },
        duration: '0.02ms',
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
        type: `message.${eventType}`,
        message: {
          id: providerMessageId,
          channel_id: recipient,
        },
        created_at: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const getstreamMock = new GetstreamMockHandler();
