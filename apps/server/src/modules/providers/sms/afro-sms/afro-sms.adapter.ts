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
import { afroSmsTransformer } from './afro-sms.transformer';
import type { AfroSmsAdapterConfig, AfroSmsApiRequest, AfroSmsApiResponse, AfroSmsWebhookPayload } from './types';

export class AfroSmsSmsAdapter implements ProviderAdapter<AfroSmsAdapterConfig, AfroSmsApiRequest, AfroSmsApiResponse> {
  readonly id = 'afro-sms';
  readonly name = 'AfroSms';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: AfroSmsAdapterConfig;

  constructor(config?: AfroSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(_configOverride?: AfroSmsAdapterConfig): boolean {
    return false;
  }

  transformRequest(options: ProviderSendOptions, config?: AfroSmsAdapterConfig): AfroSmsApiRequest {
    return afroSmsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: AfroSmsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return afroSmsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(_options: ProviderSendOptions, _configOverride?: AfroSmsAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookData = payload as AfroSmsWebhookPayload;
    const msgId = webhookData.message_id;
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
