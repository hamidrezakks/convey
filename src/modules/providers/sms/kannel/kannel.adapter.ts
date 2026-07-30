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
import { kannelTransformer } from './kannel.transformer';
import type { KannelAdapterConfig, KannelApiRequest, KannelApiResponse, KannelWebhookPayload } from './types';

export class KannelSmsAdapter implements ProviderAdapter<KannelAdapterConfig, KannelApiRequest, KannelApiResponse> {
  readonly id = 'kannel';
  readonly name = 'Kannel';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: KannelAdapterConfig;

  constructor(config?: KannelAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: KannelAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: KannelAdapterConfig): KannelApiRequest {
    return kannelTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: KannelApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return kannelTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: KannelAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Kannel',
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
      let responseJson: KannelApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as KannelApiResponse;
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
    const webhookData = payload as KannelWebhookPayload;
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
