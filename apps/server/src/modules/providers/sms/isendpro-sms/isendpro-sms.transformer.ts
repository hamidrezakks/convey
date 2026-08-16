import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { IsendproSmsAdapterConfig, IsendproSmsApiRequest, IsendproSmsApiResponse } from './types';

export class IsendproSmsTransformer
  implements ProviderTransformer<IsendproSmsAdapterConfig, IsendproSmsApiRequest, IsendproSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: IsendproSmsAdapterConfig): IsendproSmsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipientPhone = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const from = options.senderName || config?.from || config?.senderId;

    return {
      to: recipientPhone,
      from,
      text,
      mediaUrl: options.content.mediaUrl,
    };
  }

  transformResponse(response: IsendproSmsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.id || response.messageId;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      (msgId || response.status === 'success' || response.statusCode === 200)
    ) {
      return {
        success: true,
        providerMessageId: msgId || `isendpro-sms_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `ISENDPRO_SMS_ERROR_${statusCode}`,
        message: response.message || response.error || 'IsendproSms SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const isendproSmsTransformer = new IsendproSmsTransformer();
