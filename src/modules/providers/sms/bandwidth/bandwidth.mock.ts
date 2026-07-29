import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BandwidthMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('bandwidth') || lower.includes('bandwidth');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify([
        {
          id: providerMessageId,
          owner: 'usr-123',
          applicationId: 'app-123',
          time: new Date().toISOString(),
          segmentCount: 1,
          direction: 'out',
          to: ['+971501234567'],
          from: '+15551234567',
          text: 'Bandwidth SMS message',
        },
      ]),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: [{ type: 'message-delivered', message: { id: providerMessageId, to: recipient } }],
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const bandwidthMock = new BandwidthMockHandler();
