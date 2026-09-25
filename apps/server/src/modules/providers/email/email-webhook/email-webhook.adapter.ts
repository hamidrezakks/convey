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
import { emailWebhookTransformer } from './email-webhook.transformer';
import type {
  EmailWebhookAdapterConfig,
  EmailWebhookApiRequest,
  EmailWebhookApiResponse,
  EmailWebhookPayload,
} from './types';

export class EmailWebhookEmailAdapter
  implements ProviderAdapter<EmailWebhookAdapterConfig, EmailWebhookApiRequest, EmailWebhookApiResponse>
{
  readonly id = 'email-webhook';
  readonly name = 'Email Webhook';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: EmailWebhookAdapterConfig;

  constructor(config?: EmailWebhookAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: EmailWebhookAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl || config.secretHeader || config.secretKey);
  }

  transformRequest(options: ProviderSendOptions, config?: EmailWebhookAdapterConfig): EmailWebhookApiRequest {
    return emailWebhookTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: EmailWebhookApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return emailWebhookTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: EmailWebhookAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || (options.recipient.webhookUrl as string) || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || (Array.isArray(reqPayload.to) && reqPayload.to.length === 0)) {
      return {
        success: false,
        error: { code: 'INVALID_RECIPIENT', message: 'Recipient email is required', category: ErrorCategory.PERMANENT },
      };
    }

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email Webhook URL is missing',
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
      let responseJson: EmailWebhookApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as EmailWebhookApiResponse;
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

    const webhookData = payload as EmailWebhookPayload;
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
