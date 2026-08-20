import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class CequensWhatsappMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('cequens') && (lower.includes('whatsapp') || lower.includes('chat'));
  }

  buildResponse({ body, providerMessageId }: ProviderMockResponseParams): Response {
    const clientRef =
      body && typeof body === 'object' && 'clientRef' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).clientRef)
        : 'client_ref_123';

    return new Response(
      JSON.stringify({
        replyCode: 0,
        replyMessage: 'ACCEPTED',
        data: {
          messageId: providerMessageId,
          clientRef,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    const status =
      eventType === 'read' ? 'READ' : eventType === 'failed' || eventType === 'bounce' ? 'FAILED' : 'DELIVERED';

    return {
      payload: {
        messageId: providerMessageId,
        status,
        phone: recipient,
        timestamp: Math.floor(Date.now() / 1000),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const cequensWhatsappMock = new CequensWhatsappMockHandler();
