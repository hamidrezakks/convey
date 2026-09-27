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
import { sendblueTransformer } from './sendblue.transformer';
import type { SendblueAdapterConfig, SendblueApiRequest, SendblueApiResponse, SendblueWebhookPayload } from './types';

export class SendblueChatAdapter
  implements ProviderAdapter<SendblueAdapterConfig, SendblueApiRequest, SendblueApiResponse>
{
  readonly id = 'sendblue';
  readonly name = 'Sendblue';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: SendblueAdapterConfig;

  constructor(config?: SendblueAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SendblueAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey && (config.apiSecret || config.secretKey));
  }

  transformRequest(options: ProviderSendOptions, config?: SendblueAdapterConfig): SendblueApiRequest {
    return sendblueTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SendblueApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sendblueTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SendblueAdapterConfig): Promise<ProviderSendResult> {
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
    const apiSecret = config.apiSecret || config.secretKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.number) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Sendblue',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Sendblue API key or secret is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.sendblue.co/api/send-message';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'sb-api-key-id': apiKey,
          'sb-api-secret-key': apiSecret,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: SendblueApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as SendblueApiResponse;
      } catch {
        responseJson = { error_message: responseText };
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
    const webhookData = payload as SendblueWebhookPayload;
    if (!webhookData?.handle) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.status || '').toLowerCase();
    if (status === 'delivered') normalizedStatus = NormalizedStatus.DELIVERED;
    else if (status.includes('read')) normalizedStatus = NormalizedStatus.READ;
    else if (status === 'failed' || status === 'undelivered') normalizedStatus = NormalizedStatus.FAILED;
    else return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.handle,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.date_sent ? new Date(webhookData.date_sent) : new Date(),
      },
    ];
  }
}
