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
import { firetextTransformer } from './firetext.transformer';
import type { FiretextAdapterConfig, FiretextApiRequest, FiretextApiResponse, FiretextWebhookPayload } from './types';

export class FiretextSmsAdapter
  implements ProviderAdapter<FiretextAdapterConfig, FiretextApiRequest, FiretextApiResponse>
{
  readonly id = 'firetext';
  readonly name = 'Firetext';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: FiretextAdapterConfig;

  constructor(config?: FiretextAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: FiretextAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: FiretextAdapterConfig): FiretextApiRequest {
    return firetextTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: FiretextApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return firetextTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: FiretextAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as FiretextWebhookPayload;
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
