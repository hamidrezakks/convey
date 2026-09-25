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
import { clicksendTransformer } from './clicksend.transformer';
import type {
  ClicksendApiRequest,
  ClicksendApiResponse,
  ClicksendSmsAdapterConfig,
  ClicksendWebhookPayload,
} from './types';

export class ClicksendSmsAdapter
  implements ProviderAdapter<ClicksendSmsAdapterConfig, ClicksendApiRequest, ClicksendApiResponse>
{
  readonly id = 'clicksend';
  readonly name = 'Clicksend SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ClicksendSmsAdapterConfig;

  constructor(config?: ClicksendSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ClicksendSmsAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.username && config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: ClicksendSmsAdapterConfig): ClicksendApiRequest {
    return clicksendTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ClicksendApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return clicksendTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ClicksendSmsAdapterConfig): Promise<ProviderSendResult> {
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
    const username = config.username || '';
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.messages[0]?.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Clicksend',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!username || !apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Clicksend username or apiKey is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://rest.clicksend.com/v3/sms/send';
    const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: ClicksendApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ClicksendApiResponse;
      } catch {
        responseJson = { response_msg: responseText };
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

    const webhookData = payload as ClicksendWebhookPayload;
    if (!webhookData?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
