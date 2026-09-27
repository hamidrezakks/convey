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
import { nexmoTransformer } from './nexmo.transformer';
import type { NexmoAdapterConfig, NexmoApiRequest, NexmoApiResponse, NexmoWebhookPayload } from './types';

export class NexmoSmsAdapter implements ProviderAdapter<NexmoAdapterConfig, NexmoApiRequest, NexmoApiResponse> {
  readonly id = 'nexmo';
  readonly name = 'Nexmo';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: NexmoAdapterConfig;

  constructor(config?: NexmoAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: NexmoAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey && config.apiSecret);
  }

  transformRequest(options: ProviderSendOptions, config?: NexmoAdapterConfig): NexmoApiRequest {
    return nexmoTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: NexmoApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return nexmoTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: NexmoAdapterConfig): Promise<ProviderSendResult> {
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

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Nexmo',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.baseUrl || 'https://rest.nexmo.com/sms/json';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: NexmoApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as NexmoApiResponse;
      } catch {
        responseJson = { messages: [{ 'error-text': responseText }] };
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
    const webhookData = payload as NexmoWebhookPayload;
    const msgId = webhookData.messageId;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.status || '').toLowerCase();
    if (status === 'failed' || status === 'undelivered') normalizedStatus = NormalizedStatus.FAILED;
    else if (status !== 'delivered') return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
