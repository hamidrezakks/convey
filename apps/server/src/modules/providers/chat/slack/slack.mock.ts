import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class SlackMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    return url.toLowerCase().includes('slack.com');
  }

  buildResponse({ providerMessageId: _providerMessageId }: ProviderMockResponseParams): Response {
    const ts = (Date.now() / 1000).toFixed(6);
    return new Response(
      JSON.stringify({
        ok: true,
        channel: 'C12345678',
        ts,
        message: {
          text: 'Slack message content',
          bot_id: 'B12345678',
          ts,
        },
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
        type: 'event_callback',
        event: {
          type: 'message',
          subtype: eventType === 'delivered' ? undefined : 'message_changed',
          client_msg_id: providerMessageId,
          text: 'Slack webhook message',
          channel: recipient,
          ts: (Date.now() / 1000).toFixed(6),
        },
      },
      headers: { 'content-type': 'application/json', 'x-slack-signature': 'mock_slack_signature' },
    };
  }
}

export const slackMock = new SlackMockHandler();
