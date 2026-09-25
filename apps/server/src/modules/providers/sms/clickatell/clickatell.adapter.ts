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
import { clickatellTransformer } from './clickatell.transformer';
import type {
  ClickatellAdapterConfig,
  ClickatellApiRequest,
  ClickatellApiResponse,
  ClickatellWebhookPayload,
} from './types';

export class ClickatellSmsAdapter
  implements ProviderAdapter<ClickatellAdapterConfig, ClickatellApiRequest, ClickatellApiResponse>
{
  readonly id = 'clickatell';
  readonly name = 'Clickatell';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: ClickatellAdapterConfig;

  constructor(config?: ClickatellAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: ClickatellAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: ClickatellAdapterConfig): ClickatellApiRequest {
    return clickatellTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ClickatellApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return clickatellTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: ClickatellAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as ClickatellWebhookPayload;
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
