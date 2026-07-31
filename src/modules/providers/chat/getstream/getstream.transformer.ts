import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { GetstreamAdapterConfig, GetstreamApiRequest, GetstreamApiResponse } from './types';

export class GetstreamTransformer
  implements ProviderTransformer<GetstreamAdapterConfig, GetstreamApiRequest, GetstreamApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: GetstreamAdapterConfig): GetstreamApiRequest {
    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const senderId = (options.senderName || 'system') as string;
    const mediaUrls = options.content.mediaUrl;

    return {
      message: {
        text,
        user_id: senderId,
        attachments:
          mediaUrls && mediaUrls.length > 0
            ? [
                {
                  type: 'image',
                  image_url: mediaUrls[0],
                  title: options.content.title || undefined,
                },
              ]
            : undefined,
      },
    };
  }

  transformResponse(response: GetstreamApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.message?.id;

    if (statusCode >= 200 && statusCode < 300 && msgId) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code ? `ERR_${response.code}` : `GETSTREAM_ERROR_${statusCode}`,
        message: response.message_text || response.error || 'Getstream API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const getstreamTransformer = new GetstreamTransformer();
