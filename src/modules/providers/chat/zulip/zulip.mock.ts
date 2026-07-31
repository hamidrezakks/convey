import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ZulipMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('zulipchat.com') || lower.includes('zulip') || lower.includes('/api/v1/messages');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: Number.parseInt(providerMessageId.replace(/\D/g, '').substring(0, 8) || '998877', 10),
        result: 'success',
        msg: '',
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
        event: eventType,
        message: {
          id: providerMessageId,
          content: `Zulip webhook event ${eventType}`,
          display_recipient: recipient,
          timestamp: Math.floor(Date.now() / 1000),
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const zulipMock = new ZulipMockHandler();
