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
import { postmarkTransformer } from './postmark.transformer';
import type {
  PostmarkApiRequest,
  PostmarkApiResponse,
  PostmarkEmailAdapterConfig,
  PostmarkWebhookPayload,
} from './types';

export class PostmarkEmailAdapter
  implements ProviderAdapter<PostmarkEmailAdapterConfig, PostmarkApiRequest, PostmarkApiResponse>
{
  readonly id = 'postmark';
  readonly name = 'Postmark Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: PostmarkEmailAdapterConfig;

  constructor(config?: PostmarkEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PostmarkEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.serverToken);
  }

  transformRequest(options: ProviderSendOptions, config?: PostmarkEmailAdapterConfig): PostmarkApiRequest {
    return postmarkTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PostmarkApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return postmarkTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PostmarkEmailAdapterConfig): Promise<ProviderSendResult> {
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
    const serverToken = config.serverToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.To) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Postmark',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!serverToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Postmark serverToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.postmarkapp.com/email';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': serverToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: PostmarkApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PostmarkApiResponse;
      } catch {
        responseJson = { Message: responseText };
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
    const normalizedStatus = receiptStatus(payload, 'RecordType', {
      delivery: NormalizedStatus.DELIVERED,
      bounce: NormalizedStatus.BOUNCED,
      open: NormalizedStatus.OPENED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as PostmarkWebhookPayload;
    if (!webhookData?.MessageID) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.MessageID,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.DeliveredAt ? new Date(webhookData.DeliveredAt) : new Date(),
      },
    ];
  }
}
