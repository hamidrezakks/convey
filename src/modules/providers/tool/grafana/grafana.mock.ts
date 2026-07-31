import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class GrafanaMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('grafana') || url.toLowerCase().includes('oncall');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({ status: 'success', message: 'Grafana alert payload delivered', alertId: providerMessageId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  buildWebhookPayload({ eventType: _eventType, providerMessageId, recipient: _recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        state: 'alerting',
        title: 'High Memory Usage',
        ruleId: 101,
        alertId: providerMessageId,
        ruleName: 'Memory Alert',
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const grafanaMock = new GrafanaMockHandler();
