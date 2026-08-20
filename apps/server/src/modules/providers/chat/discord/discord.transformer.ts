import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { DiscordApiRequest, DiscordApiResponse, DiscordChatAdapterConfig } from './types';

export class DiscordTransformer
  implements ProviderTransformer<DiscordChatAdapterConfig, DiscordApiRequest, DiscordApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: DiscordChatAdapterConfig): DiscordApiRequest {
    const text = (options.content.text || options.content.body || '') as string;
    const title = options.content.title as string | undefined;

    const req: DiscordApiRequest = {
      content: text,
      username: options.senderName,
    };

    if (title) {
      req.embeds = [
        {
          title,
          description: text,
        },
      ];
    }

    return req;
  }

  transformResponse(response: DiscordApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if ((statusCode >= 200 && statusCode < 300) || statusCode === 204) {
      return {
        success: true,
        providerMessageId: response.id || `discord_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code ? String(response.code) : 'DISCORD_ERROR',
        message: response.message || 'Discord Webhook/Bot API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const discordTransformer = new DiscordTransformer();
