import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { TelegramApiRequest, TelegramApiResponse, TelegramChatAdapterConfig } from './types';

export class TelegramTransformer
  implements ProviderTransformer<TelegramChatAdapterConfig, TelegramApiRequest, TelegramApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: TelegramChatAdapterConfig): TelegramApiRequest {
    const rawTo = options.recipient.chatId || options.recipient.to || config?.chatId;
    const chatId = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;

    return {
      chat_id: chatId,
      text,
      parse_mode: (options.content.data?.parse_mode as string) || undefined,
    };
  }

  transformResponse(response: TelegramApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const messageId = response.result?.message_id;

    if (response.ok && messageId != null) {
      return {
        success: true,
        providerMessageId: String(messageId),
        metadata: {
          rawPayload: rawBody || response,
        },
      };
    }

    return {
      success: false,
      error: {
        code: response.error_code ? String(response.error_code) : 'TELEGRAM_ERROR',
        message: response.description || 'Telegram Bot API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: {
        rawPayload: rawBody || response,
      },
    };
  }
}

export const telegramTransformer = new TelegramTransformer();
