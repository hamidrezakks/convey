import type {
  ProviderMockHandler,
  ProviderMockResponseParams,
  ProviderWebhookMockParams,
} from '../../core/provider-module';

export class MattermostMockHandler implements ProviderMockHandler {
  matchesRequest(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('mattermost.com') || lower.includes('mattermost') || lower.includes('/api/v4/posts');
  }

  buildResponse({ providerMessageId }: ProviderMockResponseParams): Response {
    return new Response(
      JSON.stringify({
        id: providerMessageId,
        create_at: Date.now(),
        update_at: Date.now(),
        delete_at: 0,
        user_id: 'usr_mattermost_bot',
        channel_id: 'chn_123456',
        message: 'Mattermost message',
        type: '',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  buildWebhookPayload({ eventType, providerMessageId, recipient }: ProviderWebhookMockParams) {
    return {
      payload: {
        event: `posted_${eventType}`,
        data: {
          post: JSON.stringify({
            id: providerMessageId,
            channel_id: recipient,
            message: 'Mattermost webhook event',
          }),
        },
      },
      headers: { 'content-type': 'application/json' },
    };
  }
}

export const mattermostMock = new MattermostMockHandler();
