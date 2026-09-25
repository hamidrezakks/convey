import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
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
import { mailersendTransformer } from './mailersend.transformer';
import type {
  MailersendApiRequest,
  MailersendApiResponse,
  MailersendEmailAdapterConfig,
  MailersendWebhookPayload,
} from './types';

export class MailersendEmailAdapter
  implements ProviderAdapter<MailersendEmailAdapterConfig, MailersendApiRequest, MailersendApiResponse>
{
  readonly id = 'mailersend';
  readonly name = 'MailerSend Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: MailersendEmailAdapterConfig;

  constructor(config?: MailersendEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MailersendEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: MailersendEmailAdapterConfig): MailersendApiRequest {
    return mailersendTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(
    response: MailersendApiResponse,
    statusCode?: number,
    headers?: Record<string, string>,
  ): ProviderSendResult {
    return mailersendTransformer.transformResponse(response, statusCode, headers);
  }

  async send(options: ProviderSendOptions, configOverride?: MailersendEmailAdapterConfig): Promise<ProviderSendResult> {
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
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || reqPayload.to.length === 0 || !reqPayload.to[0]?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for MailerSend',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'MailerSend API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.mailersend.com/v1/email';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MailersendApiResponse = {};

      try {
        if (responseText) {
          responseJson = JSON.parse(responseText) as MailersendApiResponse;
        }
      } catch {
        responseJson = { message: responseText };
      }

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        resHeaders[key.toLowerCase()] = val;
      });

      return this.transformResponse(responseJson, response.status, resHeaders);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const normalizedStatus = receiptStatus(payload, 'type', {
      'activity.delivered': NormalizedStatus.DELIVERED,
      'activity.hard_bounced': NormalizedStatus.BOUNCED,
      'activity.soft_bounced': NormalizedStatus.BOUNCED,
      'activity.opened': NormalizedStatus.OPENED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as MailersendWebhookPayload;
    const msgId = webhookData?.data?.email?.id || webhookData?.data?.id;
    if (!msgId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.data?.created_at ? new Date(webhookData.data.created_at) : new Date(),
      },
    ];
  }
}
