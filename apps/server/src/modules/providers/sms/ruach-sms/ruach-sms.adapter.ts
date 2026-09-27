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
import { ruachSmsTransformer } from './ruach-sms.transformer';
import type { RuachSmsAdapterConfig, RuachSmsApiRequest, RuachSmsApiResponse, RuachSmsWebhookPayload } from './types';

export class RuachSmsSmsAdapter
  implements ProviderAdapter<RuachSmsAdapterConfig, RuachSmsApiRequest, RuachSmsApiResponse>
{
  readonly id = 'ruach-sms';
  readonly name = 'RuachSms';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: RuachSmsAdapterConfig;

  constructor(config?: RuachSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: RuachSmsAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: RuachSmsAdapterConfig): RuachSmsApiRequest {
    return ruachSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: RuachSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return ruachSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: RuachSmsAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as RuachSmsWebhookPayload;
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
