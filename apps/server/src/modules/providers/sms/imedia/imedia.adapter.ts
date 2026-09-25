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
import { imediaTransformer } from './imedia.transformer';
import type { ImediaAdapterConfig, ImediaApiRequest, ImediaApiResponse, ImediaWebhookPayload } from './types';

export class ImediaSmsAdapter implements ProviderAdapter<ImediaAdapterConfig, ImediaApiRequest, ImediaApiResponse> {
  readonly id = 'imedia';
  readonly name = 'Imedia';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: ImediaAdapterConfig;

  constructor(config?: ImediaAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: ImediaAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: ImediaAdapterConfig): ImediaApiRequest {
    return imediaTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ImediaApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return imediaTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: ImediaAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as ImediaWebhookPayload;
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
