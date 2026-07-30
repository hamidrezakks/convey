import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { PlivoApiRequest, PlivoApiResponse, PlivoSmsAdapterConfig } from './types';

export class PlivoTransformer implements ProviderTransformer<PlivoSmsAdapterConfig, PlivoApiRequest, PlivoApiResponse> {
  transformRequest(options: ProviderSendOptions, config?: PlivoSmsAdapterConfig): PlivoApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const dst = Array.isArray(rawTo) ? rawTo.join('<') : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || '') as string;
    const src = options.from || config?.from || '';

    return {
      src,
      dst,
      text,
    };
  }

  transformResponse(response: PlivoApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    const uuid = response.message_uuid?.[0];

    if (statusCode >= 200 && statusCode < 300 && uuid) {
      return {
        success: true,
        providerMessageId: uuid,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'PLIVO_ERROR',
        message: response.message || response.error || 'Plivo SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const plivoTransformer = new PlivoTransformer();
