import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class AfricasTalkingMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('africas-talking') || lower.includes('africastalking');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [
            {
              number: '+971501234567',
              status: 'Success',
              messageId: providerMessageId,
              cost: 'KES 0.8000',
            },
          ],
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: { id: providerMessageId, status: 'Success', phoneNumber: recipient },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const africasTalkingMock = new AfricasTalkingMockHandler();
