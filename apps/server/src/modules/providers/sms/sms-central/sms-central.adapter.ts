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
import { smsCentralTransformer } from './sms-central.transformer';
import type {
  SmsCentralAdapterConfig,
  SmsCentralApiRequest,
  SmsCentralApiResponse,
  SmsCentralWebhookPayload,
} from './types';

export class SmsCentralSmsAdapter
  implements ProviderAdapter<SmsCentralAdapterConfig, SmsCentralApiRequest, SmsCentralApiResponse>
{
  readonly id = 'sms-central';
  readonly name = 'SmsCentral';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: SmsCentralAdapterConfig;

  constructor(config?: SmsCentralAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: SmsCentralAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: SmsCentralAdapterConfig): SmsCentralApiRequest {
    return smsCentralTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SmsCentralApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return smsCentralTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: SmsCentralAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as SmsCentralWebhookPayload;
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
