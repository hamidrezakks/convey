import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class CequensMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('cequens.com') && !url.toLowerCase().includes('whatsapp');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        replyCode: 0,
        replyMessage: 'ACCEPTED',
        data: { messageId: providerMessageId, clientRef: 'client_ref_123' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        messageId: providerMessageId,
        status: eventType.toUpperCase(),
        phone: recipient,
        timestamp: Math.floor(Date.now() / 1000),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const cequensMock = new CequensMockHandler();
