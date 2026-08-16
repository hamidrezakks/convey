import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PusherBeamsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('pusher.com') || url.toLowerCase().includes('pushnotifications');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ publishId: providerMessageId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { publishId: providerMessageId, event: 'DELIVERED', user: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const pusherBeamsMock = new PusherBeamsMockHandler();
