import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class NetcoreMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return (
      url.toLowerCase().includes('pepipost.com') ||
      url.toLowerCase().includes('netcore.in') ||
      url.toLowerCase().includes('netcore')
    );
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Queued',
        data: [{ email: 'test@example.com', message_id: providerMessageId }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { event: _eventType, message_id: providerMessageId, email: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const netcoreMock = new NetcoreMockHandler();
