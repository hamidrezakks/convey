import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
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
import { createTransportFetch } from '../../core/transport';
import { resendTransformer } from './resend.transformer';
import type { ResendApiRequest, ResendApiResponse, ResendEmailAdapterConfig, ResendWebhookPayload } from './types';

export class ResendEmailAdapter
  implements ProviderAdapter<ResendEmailAdapterConfig, ResendApiRequest, ResendApiResponse>
{
  readonly id = 'resend';
  readonly name = 'Resend Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ResendEmailAdapterConfig;

  constructor(config?: ResendEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ResendEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: ResendEmailAdapterConfig): ResendApiRequest {
    return resendTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ResendApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return resendTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ResendEmailAdapterConfig): Promise<ProviderSendResult> {
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

    if (!reqPayload.to || (Array.isArray(reqPayload.to) && reqPayload.to.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Resend',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Resend API key is missing', category: ErrorCategory.PERMANENT },
      };
    }

    const endpoint = 'https://api.resend.com/emails';
    const transportFetch = createTransportFetch(config?.proxy);

    try {
      const response = await transportFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: ResendApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ResendApiResponse;
      } catch {
        responseJson = { message: responseText };
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
    const normalizedStatus = receiptStatus(payload, 'type', {
      'email.delivered': NormalizedStatus.DELIVERED,
      'email.bounced': NormalizedStatus.BOUNCED,
      'email.failed': NormalizedStatus.FAILED,
      'email.opened': NormalizedStatus.OPENED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as ResendWebhookPayload;
    if (!webhookData?.data?.email_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.data.email_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.data.created_at ? new Date(webhookData.data.created_at) : new Date(),
      },
    ];
  }
}
