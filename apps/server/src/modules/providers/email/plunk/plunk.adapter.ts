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
import { plunkTransformer } from './plunk.transformer';
import type { PlunkApiRequest, PlunkApiResponse, PlunkEmailAdapterConfig, PlunkWebhookPayload } from './types';

export class PlunkEmailAdapter implements ProviderAdapter<PlunkEmailAdapterConfig, PlunkApiRequest, PlunkApiResponse> {
  readonly id = 'plunk';
  readonly name = 'Plunk Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: PlunkEmailAdapterConfig;

  constructor(config?: PlunkEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PlunkEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: PlunkEmailAdapterConfig): PlunkApiRequest {
    return plunkTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PlunkApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return plunkTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PlunkEmailAdapterConfig): Promise<ProviderSendResult> {
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
          message: 'Recipient email is required for Plunk',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Plunk API key is missing', category: ErrorCategory.PERMANENT },
      };
    }

    const endpoint = 'https://api.useplunk.com/v1/send';

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
      let responseJson: PlunkApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PlunkApiResponse;
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

    const webhookData = payload as PlunkWebhookPayload;
    if (!webhookData?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
