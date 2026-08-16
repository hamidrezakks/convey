import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PushpadMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('pushpad.xyz');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ id: 998877, scheduled: 0, send_at: null, custom_id: providerMessageId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: 998877, custom_id: providerMessageId, event: 'delivered', uid: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const pushpadMock = new PushpadMockHandler();
