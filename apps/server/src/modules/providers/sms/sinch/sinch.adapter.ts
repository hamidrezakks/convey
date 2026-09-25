import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { httpErrorCategory, providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { sinchTransformer } from './sinch.transformer';
import type { SinchAdapterConfig, SinchApiRequest, SinchApiResponse, SinchWebhookPayload } from './types';

export class SinchSmsAdapter implements ProviderAdapter<SinchAdapterConfig, SinchApiRequest, SinchApiResponse> {
  readonly id = 'sinch';
  readonly name = 'Sinch';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: SinchAdapterConfig;

  constructor(config?: SinchAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SinchAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey && config.servicePlanId);
  }

  transformRequest(options: ProviderSendOptions, config?: SinchAdapterConfig): SinchApiRequest {
    return sinchTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SinchApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sinchTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SinchAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config))
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider credentials are required',
          category: ErrorCategory.PERMANENT,
        },
      };
    const reqPayload = this.transformRequest(options, config);
    const recipients = options.recipient.phone || options.recipient.to;
    if (!reqPayload.to || !reqPayload.text || (Array.isArray(recipients) && recipients.length !== 1))
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'One recipient and nonempty text are required',
          category: ErrorCategory.PERMANENT,
        },
      };
    if (options.content.mediaUrl?.length || options.content.templateId)
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT',
          message: 'This adapter implements text SMS only',
          category: ErrorCategory.PERMANENT,
        },
      };
    try {
      const response = await providerFetch(
        config.baseUrl ||
          `https://${config.region || 'us'}.sms.api.sinch.com/xms/v1/${encodeURIComponent(config.servicePlanId || '')}/batches`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: reqPayload.from, to: [reqPayload.to], body: reqPayload.text, type: 'mt_text' }),
        },
      );
      const responseText = await response.text();
      let responseJson: Record<string, unknown> = {};
      try {
        responseJson = JSON.parse(responseText) || {};
      } catch {
        /* Some providers return a documented text acknowledgement. */
      }

      if (response.ok && responseJson.id && !responseJson.code)
        return { success: true, providerMessageId: String(responseJson.id) };
      return {
        success: false,
        error: {
          code: 'SINCH_SEND_ERROR',
          message: 'Provider rejected the SMS request',
          category: httpErrorCategory(response.status),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: (error as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const webhookData = payload as SinchWebhookPayload;
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
