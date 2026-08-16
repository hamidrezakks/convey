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
import { sms77Transformer } from './sms77.transformer';
import type { Sms77AdapterConfig, Sms77ApiRequest, Sms77ApiResponse, Sms77WebhookPayload } from './types';

export class Sms77SmsAdapter implements ProviderAdapter<Sms77AdapterConfig, Sms77ApiRequest, Sms77ApiResponse> {
  readonly id = 'sms77';
  readonly name = 'Sms77';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: Sms77AdapterConfig;

  constructor(config?: Sms77AdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: Sms77AdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: Sms77AdapterConfig): Sms77ApiRequest {
    return sms77Transformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: Sms77ApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sms77Transformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: Sms77AdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Sms77',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.baseUrl || `https://api.${this.id}.com/v1/sms/send`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: Sms77ApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as Sms77ApiResponse;
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
    const webhookData = payload as Sms77WebhookPayload;
    const msgId = webhookData.messageId || webhookData.id;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.status || '').toLowerCase();
    if (status.includes('fail')) normalizedStatus = NormalizedStatus.FAILED;

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
