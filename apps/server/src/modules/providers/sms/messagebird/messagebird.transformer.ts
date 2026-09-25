import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { MessagebirdAdapterConfig, MessagebirdApiRequest, MessagebirdApiResponse } from './types';

export class MessagebirdTransformer
  implements ProviderTransformer<MessagebirdAdapterConfig, MessagebirdApiRequest, MessagebirdApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MessagebirdAdapterConfig): MessagebirdApiRequest {
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

  transformResponse(response: MessagebirdApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.id || response.messageId;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      (msgId || response.status === 'success' || response.statusCode === 200)
    ) {
      return {
        success: true,
        providerMessageId: msgId || `messagebird_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `MESSAGEBIRD_ERROR_${statusCode}`,
        message: response.message || response.error || 'Messagebird SMS API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const messagebirdTransformer = new MessagebirdTransformer();
