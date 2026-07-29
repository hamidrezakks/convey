import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class NodemailerMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('nodemailer') || url.toLowerCase().includes('smtp');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        messageId: `<${providerMessageId}@smtp.domain>`,
        accepted: ['test@example.com'],
        rejected: [],
        response: '250 2.0.0 OK',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: _eventType, recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const nodemailerMock = new NodemailerMockHandler();
