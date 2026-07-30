import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { AzureSmsApiRequest, AzureSmsApiResponse, AzureSmsSmsAdapterConfig } from './types';

export class AzureSmsTransformer
  implements ProviderTransformer<AzureSmsSmsAdapterConfig, AzureSmsApiRequest, AzureSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: AzureSmsSmsAdapterConfig): AzureSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const message = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from || '';

    return {
      from,
      to: toList,
      message,
      smsSendOptions: {
        enableDeliveryReport: true,
      },
    };
  }

  transformResponse(response: AzureSmsApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    const firstItem = Array.isArray(response) ? response[0] : response;
    const isSuccess =
      statusCode >= 200 && statusCode < 300 && (firstItem?.successful !== false || firstItem?.messageId);

    if (isSuccess) {
      return {
        success: true,
        providerMessageId: firstItem?.messageId || `azure_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'AZURE_SMS_ERROR',
        message: firstItem?.errorMessage || 'Azure Communication Services SMS request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const azureSmsTransformer = new AzureSmsTransformer();
