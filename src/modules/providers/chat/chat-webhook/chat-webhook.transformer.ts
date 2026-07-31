import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ChatWebhookAdapterConfig, ChatWebhookApiRequest, ChatWebhookApiResponse } from './types';

export class ChatWebhookTransformer
  implements ProviderTransformer<ChatWebhookAdapterConfig, ChatWebhookApiRequest, ChatWebhookApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: ChatWebhookAdapterConfig): ChatWebhookApiRequest {
    const target = options.recipient.channel || (options.recipient.to as string);
    const text = (options.content.text || options.content.body || options.content.title || '') as string;

    return {
      channel: options.recipient.channel,
      target,
      text,
      data: options.content.data as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: ChatWebhookApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.messageId || response.id;
    if (statusCode >= 200 && statusCode < 300 && response.success !== false) {
      return {
        success: true,
        providerMessageId: msgId || `chat_webhook_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'CHAT_WEBHOOK_ERROR',
        message: response.error || 'Chat Webhook API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const chatWebhookTransformer = new ChatWebhookTransformer();
