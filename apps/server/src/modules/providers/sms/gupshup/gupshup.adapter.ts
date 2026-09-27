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
import { gupshupTransformer } from './gupshup.transformer';
import type { GupshupAdapterConfig, GupshupApiRequest, GupshupApiResponse, GupshupWebhookPayload } from './types';

export class GupshupSmsAdapter implements ProviderAdapter<GupshupAdapterConfig, GupshupApiRequest, GupshupApiResponse> {
  readonly id = 'gupshup';
  readonly name = 'Gupshup';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: GupshupAdapterConfig;

  constructor(config?: GupshupAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: GupshupAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: GupshupAdapterConfig): GupshupApiRequest {
    return gupshupTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: GupshupApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return gupshupTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: GupshupAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as GupshupWebhookPayload;
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
