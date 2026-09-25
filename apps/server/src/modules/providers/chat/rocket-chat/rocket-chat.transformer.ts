import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { RocketChatAdapterConfig, RocketChatApiRequest, RocketChatApiResponse } from './types';

export class RocketChatTransformer
  implements ProviderTransformer<RocketChatAdapterConfig, RocketChatApiRequest, RocketChatApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: RocketChatAdapterConfig): RocketChatApiRequest {
    const rawTo = options.recipient.channel || options.recipient.to || config?.channel;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const mediaUrls = options.content.mediaUrl;

    const reqPayload: RocketChatApiRequest = {
      text,
      attachments:
        mediaUrls && mediaUrls.length > 0
          ? [
              {
                title: options.content.title || 'Attachment',
                image_url: mediaUrls[0],
                text,
              },
            ]
          : undefined,
    };

    if (recipient.startsWith('#') || recipient.startsWith('@')) {
      reqPayload.channel = recipient;
    } else {
      reqPayload.roomId = recipient;
    }

    return reqPayload;
  }

  transformResponse(response: RocketChatApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.message?._id;

    if (statusCode >= 200 && statusCode < 300 && (response.success || msgId)) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `ROCKETCHAT_ERROR_${statusCode}`,
        message: response.error || 'Rocket.Chat API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const rocketChatTransformer = new RocketChatTransformer();
