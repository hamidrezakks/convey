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
import { sparkpostTransformer } from './sparkpost.transformer';
import type {
  SparkpostApiRequest,
  SparkpostApiResponse,
  SparkpostEmailAdapterConfig,
  SparkpostWebhookPayload,
} from './types';

export class SparkpostEmailAdapter
  implements ProviderAdapter<SparkpostEmailAdapterConfig, SparkpostApiRequest, SparkpostApiResponse>
{
  readonly id = 'sparkpost';
  readonly name = 'SparkPost Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: SparkpostEmailAdapterConfig;

  constructor(config?: SparkpostEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SparkpostEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: SparkpostEmailAdapterConfig): SparkpostApiRequest {
    return sparkpostTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SparkpostApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sparkpostTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SparkpostEmailAdapterConfig): Promise<ProviderSendResult> {
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

    if (!reqPayload.recipients[0]?.address?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for SparkPost',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'SparkPost API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.endpoint || 'https://api.sparkpost.com/api/v1/transmissions';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: SparkpostApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as SparkpostApiResponse;
      } catch {
        responseJson = { errors: [{ code: 'PARSE_ERROR', message: responseText }] };
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
    const normalizedStatus = receiptStatus(payload, 'msys.message_event.type', {
      delivery: NormalizedStatus.DELIVERED,
      bounce: NormalizedStatus.BOUNCED,
      policy_rejection: NormalizedStatus.FAILED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as SparkpostWebhookPayload;
    const msgEvent = webhookData?.msys?.message_event;
    if (!msgEvent?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgEvent.message_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: msgEvent.timestamp ? new Date(Number(msgEvent.timestamp) * 1000) : new Date(),
      },
    ];
  }
}
