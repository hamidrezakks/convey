import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class BulkSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('bulk-sms') || lower.includes('bulksms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify([
        {
          id: providerMessageId,
          type: 'SENT',
          to: '+971501234567',
          status: { id: 'ACCEPTED', type: 'ACCEPTED' },
        },
      ]),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: { type: 'DELIVERED' }, to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const bulkSmsMock = new BulkSmsMockHandler();
