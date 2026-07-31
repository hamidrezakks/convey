import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ApnsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('push.apple.com') || url.toLowerCase().includes('apns');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(null, {
      status: 200,
      headers: {
        'apns-id': providerMessageId,
        'content-type': 'application/json',
      },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { apns_id: providerMessageId, status: 'delivered', device_token: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const apnsMock = new ApnsMockHandler();
