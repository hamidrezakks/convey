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
      const generatedId = `azure_sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const mockResult: AzureSmsApiResponse = {
        messageId: generatedId,
        successful: true,
      };

      return this.transformResponse(mockResult, 202, mockResult);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as AzureSmsWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
