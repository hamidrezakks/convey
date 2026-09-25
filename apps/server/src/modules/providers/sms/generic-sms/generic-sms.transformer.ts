import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { GenericSmsAdapterConfig, GenericSmsApiRequest, GenericSmsApiResponse } from './types';

export class GenericSmsTransformer
  implements ProviderTransformer<GenericSmsAdapterConfig, GenericSmsApiRequest, GenericSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: GenericSmsAdapterConfig): GenericSmsApiRequest {
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

  transformResponse(response: GenericSmsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.id || response.messageId;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      (msgId || response.status === 'success' || response.statusCode === 200)
    ) {
      return {
        success: true,
        providerMessageId: msgId || `generic-sms_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `GENERIC_SMS_ERROR_${statusCode}`,
        message: response.message || response.error || 'GenericSms SMS API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const genericSmsTransformer = new GenericSmsTransformer();
