import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class ClicksendMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('clicksend') || lower.includes('clicksend');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        http_code: 200,
        response_code: 'SUCCESS',
        response_msg: 'Messages Queued.',
        data: {
          messages: [{ message_id: providerMessageId, to: '+971501234567', status: 'SUCCESS' }],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { message_id: providerMessageId, status: 'SUCCESS', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const clicksendMock = new ClicksendMockHandler();
