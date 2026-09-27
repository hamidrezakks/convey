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
import { eazySmsTransformer } from './eazy-sms.transformer';
import type { EazySmsAdapterConfig, EazySmsApiRequest, EazySmsApiResponse, EazySmsWebhookPayload } from './types';

export class EazySmsSmsAdapter implements ProviderAdapter<EazySmsAdapterConfig, EazySmsApiRequest, EazySmsApiResponse> {
  readonly id = 'eazy-sms';
  readonly name = 'EazySms';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: EazySmsAdapterConfig;

  constructor(config?: EazySmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: EazySmsAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: EazySmsAdapterConfig): EazySmsApiRequest {
    return eazySmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: EazySmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return eazySmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: EazySmsAdapterConfig): Promise<ProviderSendResult> {
    return {
      success: false,
      error: {
        code: 'PROVIDER_NOT_IMPLEMENTED',
        message: 'Native vendor protocol is not implemented for this adapter. See docs/provider-porting-matrix.md.',
        category: ErrorCategory.PERMANENT,
      },
    };
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const webhookData = payload as EazySmsWebhookPayload;
    const msgId = webhookData.messageId || webhookData.id;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.status || '').toLowerCase();
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
