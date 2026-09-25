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
import { maqsamTransformer } from './maqsam.transformer';
import type { MaqsamAdapterConfig, MaqsamApiRequest, MaqsamApiResponse, MaqsamWebhookPayload } from './types';

export class MaqsamSmsAdapter implements ProviderAdapter<MaqsamAdapterConfig, MaqsamApiRequest, MaqsamApiResponse> {
  readonly id = 'maqsam';
  readonly name = 'Maqsam';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: MaqsamAdapterConfig;

  constructor(config?: MaqsamAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: MaqsamAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: MaqsamAdapterConfig): MaqsamApiRequest {
    return maqsamTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MaqsamApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return maqsamTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: MaqsamAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as MaqsamWebhookPayload;
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
