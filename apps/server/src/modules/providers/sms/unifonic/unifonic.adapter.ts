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
import type { UnifonicAdapterConfig, UnifonicApiRequest, UnifonicApiResponse, UnifonicWebhookPayload } from './types';
import { unifonicTransformer } from './unifonic.transformer';

export class UnifonicSmsAdapter
  implements ProviderAdapter<UnifonicAdapterConfig, UnifonicApiRequest, UnifonicApiResponse>
{
  readonly id = 'unifonic';
  readonly name = 'Unifonic';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: UnifonicAdapterConfig;

  constructor(config?: UnifonicAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: UnifonicAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: UnifonicAdapterConfig): UnifonicApiRequest {
    return unifonicTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: UnifonicApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return unifonicTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: UnifonicAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as UnifonicWebhookPayload;
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
