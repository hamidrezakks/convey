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
import { termiiTransformer } from './termii.transformer';
import type { TermiiAdapterConfig, TermiiApiRequest, TermiiApiResponse, TermiiWebhookPayload } from './types';

export class TermiiSmsAdapter implements ProviderAdapter<TermiiAdapterConfig, TermiiApiRequest, TermiiApiResponse> {
  readonly id = 'termii';
  readonly name = 'Termii';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: TermiiAdapterConfig;

  constructor(config?: TermiiAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: TermiiAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: TermiiAdapterConfig): TermiiApiRequest {
    return termiiTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TermiiApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return termiiTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: TermiiAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as TermiiWebhookPayload;
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
