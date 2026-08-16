import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class AzureSmsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('azure-sms') || lower.includes('azuresms');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify([
        {
          to: '+971501234567',
          messageId: providerMessageId,
          httpStatusCode: 202,
          successful: true,
        },
      ]),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { messageId: providerMessageId, status: 'Delivered', to: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const azureSmsMock = new AzureSmsMockHandler();
