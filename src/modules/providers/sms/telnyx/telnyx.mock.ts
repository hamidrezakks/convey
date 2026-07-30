import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class TelnyxMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('telnyx') || lower.includes('telnyx');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        data: {
          id: providerMessageId,
          type: 'message',
          record_type: 'message',
          direction: 'outbound',
          to: [{ phone_number: '+971501234567', status: 'queued' }],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        data: {
          event_type: 'message.finalized',
          payload: { id: providerMessageId, to: [{ phone_number: recipient, status: 'delivered' }] },
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const telnyxMock = new TelnyxMockHandler();
