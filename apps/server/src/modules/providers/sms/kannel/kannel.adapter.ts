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
import { kannelTransformer } from './kannel.transformer';
import type { KannelAdapterConfig, KannelApiRequest, KannelApiResponse, KannelWebhookPayload } from './types';

export class KannelSmsAdapter implements ProviderAdapter<KannelAdapterConfig, KannelApiRequest, KannelApiResponse> {
  readonly id = 'kannel';
  readonly name = 'Kannel';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: KannelAdapterConfig;

  constructor(config?: KannelAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: KannelAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: KannelAdapterConfig): KannelApiRequest {
    return kannelTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: KannelApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return kannelTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: KannelAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as KannelWebhookPayload;
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
