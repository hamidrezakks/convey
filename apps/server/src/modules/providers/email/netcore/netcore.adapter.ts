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
import { netcoreTransformer } from './netcore.transformer';
import type { NetcoreApiRequest, NetcoreApiResponse, NetcoreEmailAdapterConfig, NetcoreWebhookPayload } from './types';

export class NetcoreEmailAdapter
  implements ProviderAdapter<NetcoreEmailAdapterConfig, NetcoreApiRequest, NetcoreApiResponse>
{
  readonly id = 'netcore';
  readonly name = 'Netcore Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: NetcoreEmailAdapterConfig;

  constructor(config?: NetcoreEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: NetcoreEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: NetcoreEmailAdapterConfig): NetcoreApiRequest {
    return netcoreTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: NetcoreApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return netcoreTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: NetcoreEmailAdapterConfig): Promise<ProviderSendResult> {
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

    if (!reqPayload.personalizations[0]?.to[0]?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Netcore',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Netcore API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.netcorecloud.net/v5/mail/send';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          api_key: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: NetcoreApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as NetcoreApiResponse;
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

    const webhookData = payload as NetcoreWebhookPayload;
    if (!webhookData?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(Number(webhookData.timestamp) * 1000) : new Date(),
      },
    ];
  }
}
