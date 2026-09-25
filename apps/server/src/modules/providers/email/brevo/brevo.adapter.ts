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
import { brevoTransformer } from './brevo.transformer';
import type { BrevoApiRequest, BrevoApiResponse, BrevoEmailAdapterConfig, BrevoWebhookPayload } from './types';

export class BrevoEmailAdapter implements ProviderAdapter<BrevoEmailAdapterConfig, BrevoApiRequest, BrevoApiResponse> {
  readonly id = 'brevo';
  readonly name = 'Brevo Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: BrevoEmailAdapterConfig;

  constructor(config?: BrevoEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: BrevoEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: BrevoEmailAdapterConfig): BrevoApiRequest {
    return brevoTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BrevoApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return brevoTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: BrevoEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || reqPayload.to.length === 0 || !reqPayload.to[0]?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Brevo',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Brevo API key is missing', category: ErrorCategory.PERMANENT },
      };
    }

    const endpoint = 'https://api.brevo.com/v3/smtp/email';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: BrevoApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as BrevoApiResponse;
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
    const webhookData = payload as BrevoWebhookPayload;
    const msgId = webhookData?.['message-id'];
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const event = webhookData.event?.toLowerCase() || '';
    if (event === 'delivered') normalizedStatus = NormalizedStatus.DELIVERED;
    else if (event === 'opened') normalizedStatus = NormalizedStatus.OPENED;
    else if (event === 'bounced') normalizedStatus = NormalizedStatus.BOUNCED;
    else if (event === 'error') normalizedStatus = NormalizedStatus.FAILED;
    else return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.date ? new Date(webhookData.date) : new Date(),
      },
    ];
  }
}
