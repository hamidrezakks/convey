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
import { anypostTransformer } from './anypost.transformer';
import type { AnypostApiRequest, AnypostApiResponse, AnypostEmailAdapterConfig, AnypostWebhookPayload } from './types';

export class AnypostEmailAdapter
  implements ProviderAdapter<AnypostEmailAdapterConfig, AnypostApiRequest, AnypostApiResponse>
{
  readonly id = 'anypost';
  readonly name = 'Anypost Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: AnypostEmailAdapterConfig;

  constructor(config?: AnypostEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: AnypostEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: AnypostEmailAdapterConfig): AnypostApiRequest {
    return anypostTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: AnypostApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return anypostTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: AnypostEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || (Array.isArray(reqPayload.to) && reqPayload.to.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Anypost',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Anypost API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const baseUrl = config.baseUrl || 'https://api.anypost.io';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/email/send`;

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
      let responseJson: AnypostApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as AnypostApiResponse;
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
    const webhookData = payload as AnypostWebhookPayload;
    if (!webhookData?.messageId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    if (webhookData.status === 'opened') normalizedStatus = NormalizedStatus.OPENED;
    else if (webhookData.status === 'read') normalizedStatus = NormalizedStatus.READ;
    else if (webhookData.status === 'failed') normalizedStatus = NormalizedStatus.FAILED;
    else if (webhookData.status !== 'delivered') return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
