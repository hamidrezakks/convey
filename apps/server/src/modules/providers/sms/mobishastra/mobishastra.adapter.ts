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
import { mobishastraTransformer } from './mobishastra.transformer';
import type {
  MobishastraAdapterConfig,
  MobishastraApiRequest,
  MobishastraApiResponse,
  MobishastraWebhookPayload,
} from './types';

export class MobishastraSmsAdapter
  implements ProviderAdapter<MobishastraAdapterConfig, MobishastraApiRequest, MobishastraApiResponse>
{
  readonly id = 'mobishastra';
  readonly name = 'Mobishastra';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: MobishastraAdapterConfig;

  constructor(config?: MobishastraAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: MobishastraAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: MobishastraAdapterConfig): MobishastraApiRequest {
    return mobishastraTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MobishastraApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mobishastraTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: MobishastraAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as MobishastraWebhookPayload;
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
