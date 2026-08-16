import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { InfobipSmsAdapterConfig, InfobipSmsApiRequest, InfobipSmsApiResponse } from './types';

export class InfobipSmsTransformer
  implements ProviderTransformer<InfobipSmsAdapterConfig, InfobipSmsApiRequest, InfobipSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: InfobipSmsAdapterConfig): InfobipSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from;

    return {
      messages: [
        {
          from,
          destinations: [{ to }],
          text,
        },
      ],
    };
  }

  transformResponse(response: InfobipSmsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msg = response.messages?.[0];

    if (statusCode >= 200 && statusCode < 300 && msg?.messageId) {
      return {
        success: true,
        providerMessageId: msg.messageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: msg?.status?.name || 'INFOBIP_SMS_ERROR',
        message: msg?.status?.description || 'Infobip SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const infobipSmsTransformer = new InfobipSmsTransformer();
