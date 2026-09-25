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
import { mandrillTransformer } from './mandrill.transformer';
import type {
  MandrillApiRequest,
  MandrillApiResponse,
  MandrillEmailAdapterConfig,
  MandrillWebhookPayload,
} from './types';

export class MandrillEmailAdapter
  implements ProviderAdapter<MandrillEmailAdapterConfig, MandrillApiRequest, MandrillApiResponse>
{
  readonly id = 'mandrill';
  readonly name = 'Mandrill Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: MandrillEmailAdapterConfig;

  constructor(config?: MandrillEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MandrillEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: MandrillEmailAdapterConfig): MandrillApiRequest {
    return mandrillTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MandrillApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mandrillTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MandrillEmailAdapterConfig): Promise<ProviderSendResult> {
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
    reqPayload.key = apiKey;

    if (!reqPayload.message.to || reqPayload.message.to.length === 0 || !reqPayload.message.to[0]?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Mandrill',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Mandrill API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://mandrillapp.com/api/1.0/messages/send.json';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MandrillApiResponse = [];

      try {
        responseJson = JSON.parse(responseText) as MandrillApiResponse;
      } catch {
        // Fallback for string errors
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
    const normalizedStatus = receiptStatus(payload, 'event', {
      send: NormalizedStatus.DELIVERED,
      hard_bounce: NormalizedStatus.BOUNCED,
      soft_bounce: NormalizedStatus.BOUNCED,
      reject: NormalizedStatus.FAILED,
      open: NormalizedStatus.OPENED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as MandrillWebhookPayload;
    if (!webhookData?.msg?._id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.msg._id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.msg.ts ? new Date(webhookData.msg.ts * 1000) : new Date(),
      },
    ];
  }
}
