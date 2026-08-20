import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { BrevoSmsApiRequest, BrevoSmsApiResponse, BrevoSmsSmsAdapterConfig } from './types';

export class BrevoSmsTransformer
  implements ProviderTransformer<BrevoSmsSmsAdapterConfig, BrevoSmsApiRequest, BrevoSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: BrevoSmsSmsAdapterConfig): BrevoSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const content = (options.content.text || options.content.body || '') as string;
    const sender = options.from || config?.from || config?.sender || 'Convey';

    return {
      sender,
      recipient,
      content,
      type: 'transactional',
    };
  }

  transformResponse(response: BrevoSmsApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    const msgId = response.reference || (response.messageId != null ? String(response.messageId) : undefined);

    if (statusCode >= 200 && statusCode < 300 && msgId) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code || 'BREVO_SMS_ERROR',
        message: response.message || 'Brevo SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const brevoSmsTransformer = new BrevoSmsTransformer();
