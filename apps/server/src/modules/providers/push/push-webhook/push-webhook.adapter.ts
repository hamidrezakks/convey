import type { ProviderAdapter } from '../../core/provider-adapter';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { receiptStatus } from '../../core/receipt-status';
import { pushWebhookTransformer } from './push-webhook.transformer';
import type {
  PushWebhookAdapterConfig,
  PushWebhookApiRequest,
  PushWebhookApiResponse,
  PushWebhookPayload,
} from './types';

export class PushWebhookPushAdapter
  implements ProviderAdapter<PushWebhookAdapterConfig, PushWebhookApiRequest, PushWebhookApiResponse>
{
  readonly id = 'push-webhook';
  readonly name = 'Push Webhook';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: PushWebhookAdapterConfig;

  constructor(config?: PushWebhookAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PushWebhookAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl || config.secretHeader || config.secretKey);
  }

  transformRequest(options: ProviderSendOptions, config?: PushWebhookAdapterConfig): PushWebhookApiRequest {
    return pushWebhookTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PushWebhookApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return pushWebhookTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PushWebhookAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || (options.recipient.webhookUrl as string) || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.target || (Array.isArray(reqPayload.target) && reqPayload.target.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Target token/channel is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Push Webhook URL is missing',
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
      const response = await providerFetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: PushWebhookApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PushWebhookApiResponse;
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
    if (!payload || typeof payload !== 'object') return [];
    const normalizedStatus = receiptStatus(payload, 'status', {
      delivered: NormalizedStatus.DELIVERED,
      failed: NormalizedStatus.FAILED,
      undelivered: NormalizedStatus.FAILED,
      bounced: NormalizedStatus.BOUNCED,
      opened: NormalizedStatus.OPENED,
      read: NormalizedStatus.READ,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as PushWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
