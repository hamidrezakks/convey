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
import { infobipSmsTransformer } from './infobip.transformer';
import type {
  InfobipSmsAdapterConfig,
  InfobipSmsApiRequest,
  InfobipSmsApiResponse,
  InfobipSmsWebhookPayload,
} from './types';

export class InfobipSmsAdapter
  implements ProviderAdapter<InfobipSmsAdapterConfig, InfobipSmsApiRequest, InfobipSmsApiResponse>
{
  readonly id = 'infobip';
  readonly name = 'Infobip SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: InfobipSmsAdapterConfig;

  constructor(config?: InfobipSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: InfobipSmsAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey && config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: InfobipSmsAdapterConfig): InfobipSmsApiRequest {
    return infobipSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: InfobipSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return infobipSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: InfobipSmsAdapterConfig): Promise<ProviderSendResult> {
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
    const baseUrl = config.baseUrl || 'https://api.infobip.com';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.messages[0]?.destinations[0]?.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Infobip SMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Infobip API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/sms/2/text/advanced`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: InfobipSmsApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as InfobipSmsApiResponse;
      } catch {
        responseJson = { messages: [{ status: { name: 'PARSE_ERROR', description: responseText } }] };
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

    const webhookData = payload as InfobipSmsWebhookPayload;
    const firstResult = webhookData?.results?.[0];
    if (!firstResult?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: firstResult.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
