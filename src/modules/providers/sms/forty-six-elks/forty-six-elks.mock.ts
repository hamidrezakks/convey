import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class FortySixElksMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('forty-six-elks') || lower.includes('fortysixelks');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        from: 'Convey',
        to: '+971501234567',
        message: 'SMS text',
        status: 'created',
        created: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'delivered', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const fortySixElksMock = new FortySixElksMockHandler();
