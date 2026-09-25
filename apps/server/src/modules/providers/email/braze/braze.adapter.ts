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
import { brazeEmailTransformer } from './braze.transformer';
import type {
  BrazeEmailAdapterConfig,
  BrazeEmailApiRequest,
  BrazeEmailApiResponse,
  BrazeEmailWebhookPayload,
} from './types';

export class BrazeEmailAdapter
  implements ProviderAdapter<BrazeEmailAdapterConfig, BrazeEmailApiRequest, BrazeEmailApiResponse>
{
  readonly id = 'braze';
  readonly name = 'Braze Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: BrazeEmailAdapterConfig;

  constructor(config?: BrazeEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: BrazeEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: BrazeEmailAdapterConfig): BrazeEmailApiRequest {
    return brazeEmailTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BrazeEmailApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return brazeEmailTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: BrazeEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.messages.email_message.recipient.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Braze',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Braze API key is missing', category: ErrorCategory.PERMANENT },
      };
    }

    const baseUrl = config.baseUrl || 'https://rest.iad-01.braze.com';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/messages/send`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: BrazeEmailApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as BrazeEmailApiResponse;
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
    const normalizedStatus = receiptStatus(payload, 'status', {
      delivered: NormalizedStatus.DELIVERED,
      failed: NormalizedStatus.FAILED,
      undelivered: NormalizedStatus.FAILED,
      bounced: NormalizedStatus.BOUNCED,
      opened: NormalizedStatus.OPENED,
      read: NormalizedStatus.READ,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as BrazeEmailWebhookPayload;
    if (!webhookData?.dispatch_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.dispatch_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(Number(webhookData.timestamp) * 1000) : new Date(),
      },
    ];
  }
}
