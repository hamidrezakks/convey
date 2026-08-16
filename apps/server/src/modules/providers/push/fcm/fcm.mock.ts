import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class FcmMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('googleapis.com') || url.toLowerCase().includes('fcm');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ name: `projects/my-project/messages/${providerMessageId}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { message_id: providerMessageId, event: 'DELIVERED', token: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const fcmMock = new FcmMockHandler();
