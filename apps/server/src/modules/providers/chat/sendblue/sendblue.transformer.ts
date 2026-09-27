import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { SendblueAdapterConfig, SendblueApiRequest, SendblueApiResponse } from './types';

export class SendblueTransformer
  implements ProviderTransformer<SendblueAdapterConfig, SendblueApiRequest, SendblueApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: SendblueAdapterConfig): SendblueApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipientPhone = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const content = (options.content.text || options.content.body || options.content.title || '') as string;
    const mediaUrls = options.content.mediaUrl;

    return {
      number: recipientPhone,
      content,
      media_url: mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : undefined,
    };
  }

  transformResponse(response: SendblueApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const handle = response.handle || response.message_handle;

    if (statusCode >= 200 && statusCode < 300 && handle) {
      return {
        success: true,
        providerMessageId: handle,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code ? `ERR_${response.code}` : `SENDBLUE_ERROR_${statusCode}`,
        message: response.error_message || 'Sendblue API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const sendblueTransformer = new SendblueTransformer();
