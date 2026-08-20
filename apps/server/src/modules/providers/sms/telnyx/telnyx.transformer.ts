import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { TelnyxApiRequest, TelnyxApiResponse, TelnyxSmsAdapterConfig } from './types';

export class TelnyxTransformer
  implements ProviderTransformer<TelnyxSmsAdapterConfig, TelnyxApiRequest, TelnyxApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: TelnyxSmsAdapterConfig): TelnyxApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from;

    return {
      from,
      to,
      text,
      messaging_profile_id: config?.messagingProfileId,
      media_urls: options.content.mediaUrl,
    };
  }

  transformResponse(response: TelnyxApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.data?.id) {
      return {
        success: true,
        providerMessageId: response.data.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    const firstErr = response.errors?.[0];
    return {
      success: false,
      error: {
        code: firstErr?.code || 'TELNYX_ERROR',
        message: firstErr?.detail || firstErr?.title || 'Telnyx Messaging v2 API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const telnyxTransformer = new TelnyxTransformer();
