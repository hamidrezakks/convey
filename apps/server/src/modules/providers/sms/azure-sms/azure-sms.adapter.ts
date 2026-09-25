import { SmsClient } from '@azure/communication-sms';
import type { ProviderAdapter } from '../../core/provider-adapter';
import { httpErrorCategory } from '../../core/provider-http';
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
import { azureSmsTransformer } from './azure-sms.transformer';
import type {
  AzureSmsApiRequest,
  AzureSmsApiResponse,
  AzureSmsSmsAdapterConfig,
  AzureSmsWebhookPayload,
} from './types';

export class AzureSmsSmsAdapter
  implements ProviderAdapter<AzureSmsSmsAdapterConfig, AzureSmsApiRequest, AzureSmsApiResponse>
{
  readonly id = 'azure-sms';
  readonly name = 'Azure SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: AzureSmsSmsAdapterConfig;

  constructor(config?: AzureSmsSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: AzureSmsSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.connectionString);
  }

  transformRequest(options: ProviderSendOptions, config?: AzureSmsSmsAdapterConfig): AzureSmsApiRequest {
    return azureSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: AzureSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return azureSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: AzureSmsSmsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const connectionString = config.connectionString || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || reqPayload.to.length === 0 || !reqPayload.to[0]) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Azure SMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!connectionString) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Azure SMS connectionString is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    try {
      const client = new SmsClient(connectionString, { retryOptions: { maxRetries: 0 } });
      const result = await client.send(
        { from: reqPayload.from, to: reqPayload.to, message: reqPayload.message },
        { enableDeliveryReport: true, abortSignal: AbortSignal.timeout(30_000) },
      );
      return this.transformResponse(result, 202, result);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'HTTP_FETCH_ERROR',
          message: (err as Error).message,
          category: httpErrorCategory((err as { statusCode?: number }).statusCode ?? 503),
        },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const normalizedStatus = receiptStatus(payload, 'deliveryStatus', {
      delivered: NormalizedStatus.DELIVERED,
      failed: NormalizedStatus.FAILED,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as AzureSmsWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
