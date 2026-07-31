import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class PagerdutyMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('pagerduty.com') || url.toLowerCase().includes('events.pagerduty.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({ status: 'success', message: 'Event processed', dedup_key: providerMessageId }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient: _recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        messages: [
          {
            id: providerMessageId,
            event: 'incident.trigger',
            incident: { id: providerMessageId, status: 'triggered' },
          },
        ],
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const pagerdutyMock = new PagerdutyMockHandler();
