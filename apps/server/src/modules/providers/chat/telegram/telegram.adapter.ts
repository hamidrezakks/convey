import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { telegramTransformer } from './telegram.transformer';
import type { TelegramApiRequest, TelegramApiResponse, TelegramChatAdapterConfig } from './types';

export class TelegramChatAdapter
  implements ProviderAdapter<TelegramChatAdapterConfig, TelegramApiRequest, TelegramApiResponse>
{
  readonly id = 'telegram';
  readonly name = 'Telegram Chat';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
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
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.botToken);
  }

  transformRequest(options: ProviderSendOptions, config?: TelegramChatAdapterConfig): TelegramApiRequest {
    return telegramTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TelegramApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return telegramTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: TelegramChatAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider configuration is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
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
      const response = await providerFetch(endpoint, {
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

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // This integration has no implemented outbound delivery receipt contract.
    return [];
  }
}
