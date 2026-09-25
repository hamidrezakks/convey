import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { RuachSmsAdapterConfig, RuachSmsApiRequest, RuachSmsApiResponse } from './types';

export class RuachSmsTransformer
  implements ProviderTransformer<RuachSmsAdapterConfig, RuachSmsApiRequest, RuachSmsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: RuachSmsAdapterConfig): RuachSmsApiRequest {
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

  transformResponse(response: RuachSmsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.id || response.messageId;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      (msgId || response.status === 'success' || response.statusCode === 200)
    ) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `RUACH_SMS_ERROR_${statusCode}`,
        message: response.message || response.error || 'RuachSms SMS API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const ruachSmsTransformer = new RuachSmsTransformer();
