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
import { sendchampTransformer } from './sendchamp.transformer';
import type {
  SendchampAdapterConfig,
  SendchampApiRequest,
  SendchampApiResponse,
  SendchampWebhookPayload,
} from './types';

export class SendchampSmsAdapter
  implements ProviderAdapter<SendchampAdapterConfig, SendchampApiRequest, SendchampApiResponse>
{
  readonly id = 'sendchamp';
  readonly name = 'Sendchamp';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: SendchampAdapterConfig;

  constructor(config?: SendchampAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: SendchampAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: SendchampAdapterConfig): SendchampApiRequest {
    return sendchampTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SendchampApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sendchampTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: SendchampAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as SendchampWebhookPayload;
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
