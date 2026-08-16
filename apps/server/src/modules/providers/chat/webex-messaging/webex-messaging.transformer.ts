import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { WebexMessagingAdapterConfig, WebexMessagingApiRequest, WebexMessagingApiResponse } from './types';

export class WebexMessagingTransformer
  implements ProviderTransformer<WebexMessagingAdapterConfig, WebexMessagingApiRequest, WebexMessagingApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: WebexMessagingAdapterConfig): WebexMessagingApiRequest {
    const rawTo = options.recipient.email || options.recipient.phone || options.recipient.to;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const roomId = (options.recipient.roomId || options.recipient.channel || config?.roomId) as string | undefined;

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const markdown = (options.content.markdown || options.content.html) as string | undefined;
    const mediaUrls = options.content.mediaUrl;

    const req: WebexMessagingApiRequest = {
      text,
      markdown,
      files: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
    };

    if (roomId) {
      req.roomId = roomId;
    } else if (recipient.includes('@')) {
      req.toPersonEmail = recipient;
    } else {
      req.toPersonId = recipient;
    }

    return req;
  }

  transformResponse(response: WebexMessagingApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id) {
      return {
        success: true,
        providerMessageId: response.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    const errorMsg = response.message || response.errors?.[0]?.description || 'Webex Messaging API request failed';

    return {
      success: false,
      error: {
        code: `WEBEX_ERROR_${statusCode}`,
        message: errorMsg,
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const webexMessagingTransformer = new WebexMessagingTransformer();
