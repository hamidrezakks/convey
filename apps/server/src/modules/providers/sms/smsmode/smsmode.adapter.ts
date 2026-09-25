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
import { smsmodeTransformer } from './smsmode.transformer';
import type { SmsmodeAdapterConfig, SmsmodeApiRequest, SmsmodeApiResponse, SmsmodeWebhookPayload } from './types';

export class SmsmodeSmsAdapter implements ProviderAdapter<SmsmodeAdapterConfig, SmsmodeApiRequest, SmsmodeApiResponse> {
  readonly id = 'smsmode';
  readonly name = 'Smsmode';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: SmsmodeAdapterConfig;

  constructor(config?: SmsmodeAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: SmsmodeAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: SmsmodeAdapterConfig): SmsmodeApiRequest {
    return smsmodeTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SmsmodeApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return smsmodeTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: SmsmodeAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as SmsmodeWebhookPayload;
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
