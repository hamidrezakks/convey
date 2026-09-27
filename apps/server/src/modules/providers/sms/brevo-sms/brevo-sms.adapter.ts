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
import { brevoSmsTransformer } from './brevo-sms.transformer';
import type { BrevoSmsAdapterConfig, BrevoSmsApiRequest, BrevoSmsApiResponse, BrevoSmsWebhookPayload } from './types';

export class BrevoSmsSmsAdapter
  implements ProviderAdapter<BrevoSmsAdapterConfig, BrevoSmsApiRequest, BrevoSmsApiResponse>
{
  readonly id = 'brevo-sms';
  readonly name = 'BrevoSms';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: BrevoSmsAdapterConfig;

  constructor(config?: BrevoSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: BrevoSmsAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: BrevoSmsAdapterConfig): BrevoSmsApiRequest {
    return brevoSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BrevoSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return brevoSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: BrevoSmsAdapterConfig): Promise<ProviderSendResult> {
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

    if (!reqPayload.recipient) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for BrevoSms',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.baseUrl || 'https://api.brevo.com/v3/transactionalSMS/send';

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
      let responseJson: BrevoSmsApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as BrevoSmsApiResponse;
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
    const webhookData = payload as BrevoSmsWebhookPayload;
    const msgId = webhookData.messageId ? String(webhookData.messageId) : undefined;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.event || '').toLowerCase();
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
