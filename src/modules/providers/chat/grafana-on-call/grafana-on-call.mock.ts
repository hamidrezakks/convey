import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class GrafanaOnCallMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('grafana.net') || lower.includes('grafana-on-call') || lower.includes('oncall');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        alert_id: providerMessageId,
        status: 'ok',
        created_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        alert_id: providerMessageId,
        state: eventType === 'delivered' ? 'resolved' : 'firing',
        route: recipient,
        timestamp: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const grafanaOnCallMock = new GrafanaOnCallMockHandler();
