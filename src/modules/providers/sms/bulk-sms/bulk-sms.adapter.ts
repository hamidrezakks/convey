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
import { bulkSmsTransformer } from './bulk-sms.transformer';
import type { BulkSmsApiRequest, BulkSmsApiResponse, BulkSmsSmsAdapterConfig, BulkSmsWebhookPayload } from './types';

export class BulkSmsSmsAdapter
  implements ProviderAdapter<BulkSmsSmsAdapterConfig, BulkSmsApiRequest, BulkSmsApiResponse>
{
  readonly id = 'bulk-sms';
  readonly name = 'BulkSMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: BulkSmsSmsAdapterConfig;

  constructor(config?: BulkSmsSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: BulkSmsSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.username || config.password || config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: BulkSmsSmsAdapterConfig): BulkSmsApiRequest {
    return bulkSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BulkSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return bulkSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: BulkSmsSmsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const username = config.username || '';
    const password = config.password || '';
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for BulkSMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey && (!username || !password)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'BulkSMS credentials are missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.bulksms.com/v1/messages';
    const authHeader = apiKey
      ? `Bearer ${apiKey}`
      : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([reqPayload]),
      });

      const responseText = await response.text();
      let responseJson: BulkSmsApiResponse = [];

      try {
        responseJson = JSON.parse(responseText) as BulkSmsApiResponse;
      } catch {
        responseJson = [{ status: { type: 'ERROR', message: responseText } }];
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
    const webhookData = payload as BulkSmsWebhookPayload;
    if (!webhookData?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
