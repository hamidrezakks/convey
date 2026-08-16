import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class RingCentralMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('ring-central') || lower.includes('ringcentral');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        uri: `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/message-store/${providerMessageId}`,
        type: 'SMS',
        creationTime: new Date().toISOString(),
        messageStatus: 'Outbound',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, messageStatus: 'Delivered', recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const ringCentralMock = new RingCentralMockHandler();
