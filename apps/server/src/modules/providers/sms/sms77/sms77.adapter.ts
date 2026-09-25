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
import { sms77Transformer } from './sms77.transformer';
import type { Sms77AdapterConfig, Sms77ApiRequest, Sms77ApiResponse, Sms77WebhookPayload } from './types';

export class Sms77SmsAdapter implements ProviderAdapter<Sms77AdapterConfig, Sms77ApiRequest, Sms77ApiResponse> {
  readonly id = 'sms77';
  readonly name = 'Sms77';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: Sms77AdapterConfig;

  constructor(config?: Sms77AdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: Sms77AdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: Sms77AdapterConfig): Sms77ApiRequest {
    return sms77Transformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: Sms77ApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sms77Transformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: Sms77AdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as Sms77WebhookPayload;
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
