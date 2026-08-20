import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MsTeamsMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('webhook.office.com') || lower.includes('msteams') || lower.includes('graph.microsoft.com');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        createdDateTime: new Date().toISOString(),
        status: 'Sent',
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
        id: providerMessageId,
        type: 'message',
        event: eventType,
        channelId: recipient,
        createdDateTime: new Date().toISOString(),
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const msTeamsMock = new MsTeamsMockHandler();
