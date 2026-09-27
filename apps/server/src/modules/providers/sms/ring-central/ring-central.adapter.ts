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
import { ringCentralTransformer } from './ring-central.transformer';
import type {
  RingCentralAdapterConfig,
  RingCentralApiRequest,
  RingCentralApiResponse,
  RingCentralWebhookPayload,
} from './types';

export class RingCentralSmsAdapter
  implements ProviderAdapter<RingCentralAdapterConfig, RingCentralApiRequest, RingCentralApiResponse>
{
  readonly id = 'ring-central';
  readonly name = 'RingCentral';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: RingCentralAdapterConfig;

  constructor(config?: RingCentralAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: RingCentralAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: RingCentralAdapterConfig): RingCentralApiRequest {
    return ringCentralTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: RingCentralApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return ringCentralTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: RingCentralAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as RingCentralWebhookPayload;
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
