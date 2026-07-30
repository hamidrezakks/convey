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
import { mobishastraTransformer } from './mobishastra.transformer';
import type {
  MobishastraAdapterConfig,
  MobishastraApiRequest,
  MobishastraApiResponse,
  MobishastraWebhookPayload,
} from './types';

export class MobishastraSmsAdapter
  implements ProviderAdapter<MobishastraAdapterConfig, MobishastraApiRequest, MobishastraApiResponse>
{
  readonly id = 'mobishastra';
  readonly name = 'Mobishastra';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: MobishastraAdapterConfig;

  constructor(config?: MobishastraAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MobishastraAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: MobishastraAdapterConfig): MobishastraApiRequest {
    return mobishastraTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MobishastraApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mobishastraTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MobishastraAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Mobishastra',
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
      let responseJson: MobishastraApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MobishastraApiResponse;
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
    const webhookData = payload as MobishastraWebhookPayload;
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
