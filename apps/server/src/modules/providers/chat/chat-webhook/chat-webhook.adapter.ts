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
import { chatWebhookTransformer } from './chat-webhook.transformer';
import type {
  ChatWebhookAdapterConfig,
  ChatWebhookApiRequest,
  ChatWebhookApiResponse,
  ChatWebhookPayload,
} from './types';

export class ChatWebhookChatAdapter
  implements ProviderAdapter<ChatWebhookAdapterConfig, ChatWebhookApiRequest, ChatWebhookApiResponse>
{
  readonly id = 'chat-webhook';
  readonly name = 'Chat Webhook';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ChatWebhookAdapterConfig;

  constructor(config?: ChatWebhookAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ChatWebhookAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl || config.secretHeader || config.secretKey);
  }

  transformRequest(options: ProviderSendOptions, config?: ChatWebhookAdapterConfig): ChatWebhookApiRequest {
    return chatWebhookTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ChatWebhookApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return chatWebhookTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ChatWebhookAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || (options.recipient.webhookUrl as string) || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Chat Webhook URL is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.secretHeader && config.secretKey) {
      headers[config.secretHeader] = config.secretKey;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: ChatWebhookApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ChatWebhookApiResponse;
      } catch {
        responseJson = { error: responseText };
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
    const webhookData = payload as ChatWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
