import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { BulkSmsApiRequest, BulkSmsApiResponse, BulkSmsSmsAdapterConfig } from './types';

export class BulkSmsTransformer
  implements ProviderTransformer<BulkSmsSmsAdapterConfig, BulkSmsApiRequest, BulkSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: BulkSmsSmsAdapterConfig): BulkSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const body = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from;

    return {
      to,
      body,
      from,
    };
  }

  transformResponse(response: BulkSmsApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    const firstItem = Array.isArray(response) ? response[0] : undefined;

    if (statusCode >= 200 && statusCode < 300 && firstItem?.id) {
      return {
        success: true,
        providerMessageId: firstItem.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: firstItem?.status?.type || 'BULKSMS_ERROR',
        message: firstItem?.status?.message || 'BulkSMS API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const bulkSmsTransformer = new BulkSmsTransformer();
