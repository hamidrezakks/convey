import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class Outlook365MockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('graph.microsoft.com') && url.toLowerCase().includes('sendmail');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(JSON.stringify({ id: providerMessageId, status: 'Queued' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        value: [
          {
            subscriptionId: 'sub_123',
            clientState: 'state',
            resourceData: { id: providerMessageId, status: _eventType, recipient },
          },
        ],
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const outlook365Mock = new Outlook365MockHandler();
