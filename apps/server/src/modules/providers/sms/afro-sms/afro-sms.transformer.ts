import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { AfroSmsApiRequest, AfroSmsApiResponse, AfroSmsSmsAdapterConfig } from './types';

export class AfroSmsTransformer
  implements ProviderTransformer<AfroSmsSmsAdapterConfig, AfroSmsApiRequest, AfroSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: AfroSmsSmsAdapterConfig): AfroSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const message = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from || config?.senderId;

    return {
      to,
      message,
      from,
    };
  }

  transformResponse(response: AfroSmsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.message_id;
    if (statusCode >= 200 && statusCode < 300 && (response.acknowledge === 'success' || msgId)) {
      return {
        success: true,
        providerMessageId: msgId || `afro_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'AFRO_SMS_ERROR',
        message: response.error || response.status || 'Afro SMS request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const afroSmsTransformer = new AfroSmsTransformer();
