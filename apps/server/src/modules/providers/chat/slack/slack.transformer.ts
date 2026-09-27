import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { SlackApiRequest, SlackApiResponse, SlackChatAdapterConfig } from './types';

export class SlackTransformer
  implements ProviderTransformer<SlackChatAdapterConfig, SlackApiRequest, SlackApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: SlackChatAdapterConfig): SlackApiRequest {
    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const channel = options.recipient.channel || config?.channel;

    return {
      channel,
      text,
    };
  }

  transformResponse(response: SlackApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.ok === true && response.ts) {
      return {
        success: true,
        providerMessageId: response.ts,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'SLACK_ERROR',
        message: response.error || 'Slack Webhook / API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const slackTransformer = new SlackTransformer();
