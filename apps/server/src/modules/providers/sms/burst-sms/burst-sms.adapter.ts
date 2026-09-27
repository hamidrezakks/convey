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
import { burstSmsTransformer } from './burst-sms.transformer';
import type { BurstSmsAdapterConfig, BurstSmsApiRequest, BurstSmsApiResponse, BurstSmsWebhookPayload } from './types';

export class BurstSmsSmsAdapter
  implements ProviderAdapter<BurstSmsAdapterConfig, BurstSmsApiRequest, BurstSmsApiResponse>
{
  readonly id = 'burst-sms';
  readonly name = 'BurstSms';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: BurstSmsAdapterConfig;

  constructor(config?: BurstSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: BurstSmsAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: BurstSmsAdapterConfig): BurstSmsApiRequest {
    return burstSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BurstSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return burstSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: BurstSmsAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as BurstSmsWebhookPayload;
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
