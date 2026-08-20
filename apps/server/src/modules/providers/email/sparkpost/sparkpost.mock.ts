import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SparkpostMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('sparkpost.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        results: {
          total_accepted_recipients: 1,
          total_rejected_recipients: 0,
          id: providerMessageId,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: [{ msys: { message_event: { type: _eventType, message_id: providerMessageId, rcpt_to: recipient } } }],
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const sparkpostMock = new SparkpostMockHandler();
