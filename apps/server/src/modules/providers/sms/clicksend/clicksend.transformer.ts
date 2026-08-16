import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ClicksendApiRequest, ClicksendApiResponse, ClicksendSmsAdapterConfig } from './types';

export class ClicksendTransformer
  implements ProviderTransformer<ClicksendSmsAdapterConfig, ClicksendApiRequest, ClicksendApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: ClicksendSmsAdapterConfig): ClicksendApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const body = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from;

    return {
      messages: [
        {
          to,
          body,
          from,
        },
      ],
    };
  }

  transformResponse(response: ClicksendApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msg = response.data?.messages?.[0];

    if (statusCode >= 200 && statusCode < 300 && response.response_code === 'SUCCESS' && msg?.message_id) {
      return {
        success: true,
        providerMessageId: msg.message_id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.response_code || 'CLICKSEND_ERROR',
        message: response.response_msg || 'Clicksend SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const clicksendTransformer = new ClicksendTransformer();
