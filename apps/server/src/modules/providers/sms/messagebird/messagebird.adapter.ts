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
import { messagebirdTransformer } from './messagebird.transformer';
import type {
  MessagebirdAdapterConfig,
  MessagebirdApiRequest,
  MessagebirdApiResponse,
  MessagebirdWebhookPayload,
} from './types';

export class MessagebirdSmsAdapter
  implements ProviderAdapter<MessagebirdAdapterConfig, MessagebirdApiRequest, MessagebirdApiResponse>
{
  readonly id = 'messagebird';
  readonly name = 'Messagebird';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: MessagebirdAdapterConfig;

  constructor(config?: MessagebirdAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: MessagebirdAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: MessagebirdAdapterConfig): MessagebirdApiRequest {
    return messagebirdTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MessagebirdApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return messagebirdTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: MessagebirdAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as MessagebirdWebhookPayload;
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
