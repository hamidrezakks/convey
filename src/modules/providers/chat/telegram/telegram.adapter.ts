import type { ProviderAdapter } from '../../core/provider-adapter';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { telegramTransformer } from './telegram.transformer';
import type {
  TelegramApiRequest,
  TelegramApiResponse,
  TelegramChatAdapterConfig,
  TelegramWebhookPayload,
} from './types';

export class TelegramChatAdapter
  implements ProviderAdapter<TelegramChatAdapterConfig, TelegramApiRequest, TelegramApiResponse>
{
  readonly id = 'telegram';
  readonly name = 'Telegram Chat';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: TelegramChatAdapterConfig;

  constructor(config?: TelegramChatAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: TelegramChatAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.botToken);
  }

  transformRequest(options: ProviderSendOptions, config?: TelegramChatAdapterConfig): TelegramApiRequest {
    return telegramTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TelegramApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return telegramTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: TelegramChatAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const botToken = config.botToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.chat_id) {
      return {
        success: false,
        error: { code: 'INVALID_RECIPIENT', message: 'Telegram chatId is required', category: ErrorCategory.PERMANENT },
      };
    }

    if (!reqPayload.text) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Text content is required for Telegram',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!botToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Telegram bot token is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: TelegramApiResponse = { ok: false };

      try {
        responseJson = JSON.parse(responseText) as TelegramApiResponse;
      } catch {
        responseJson = { ok: false, description: responseText };
      }

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as TelegramWebhookPayload;
    if (!webhookData?.message?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: String(webhookData.message.message_id),
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.message.date ? new Date(webhookData.message.date * 1000) : new Date(),
      },
    ];
  }
}
