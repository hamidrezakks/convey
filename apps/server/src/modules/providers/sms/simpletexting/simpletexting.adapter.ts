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
import { simpletextingTransformer } from './simpletexting.transformer';
import type {
  SimpletextingAdapterConfig,
  SimpletextingApiRequest,
  SimpletextingApiResponse,
  SimpletextingWebhookPayload,
} from './types';

export class SimpletextingSmsAdapter
  implements ProviderAdapter<SimpletextingAdapterConfig, SimpletextingApiRequest, SimpletextingApiResponse>
{
  readonly id = 'simpletexting';
  readonly name = 'Simpletexting';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: SimpletextingAdapterConfig;

  constructor(config?: SimpletextingAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: SimpletextingAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: SimpletextingAdapterConfig): SimpletextingApiRequest {
    return simpletextingTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SimpletextingApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return simpletextingTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: SimpletextingAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as SimpletextingWebhookPayload;
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
