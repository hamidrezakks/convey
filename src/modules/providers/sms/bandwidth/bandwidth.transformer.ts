import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { BandwidthApiRequest, BandwidthApiResponse, BandwidthSmsAdapterConfig } from './types';

export class BandwidthTransformer
  implements ProviderTransformer<BandwidthSmsAdapterConfig, BandwidthApiRequest, BandwidthApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: BandwidthSmsAdapterConfig): BandwidthApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const message = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from || '';

    return {
      from,
      to: toList,
      text: message,
      applicationId: config?.applicationId || '',
      media: options.content.mediaUrl,
    };
  }

  transformResponse(response: BandwidthApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id) {
      return {
        success: true,
        providerMessageId: response.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'BANDWIDTH_ERROR',
        message: response.message || 'Bandwidth Messaging v2 API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const bandwidthTransformer = new BandwidthTransformer();
