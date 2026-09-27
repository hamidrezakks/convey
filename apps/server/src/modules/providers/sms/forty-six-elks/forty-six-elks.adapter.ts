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
import { fortySixElksTransformer } from './forty-six-elks.transformer';
import type {
  FortySixElksAdapterConfig,
  FortySixElksApiRequest,
  FortySixElksApiResponse,
  FortySixElksWebhookPayload,
} from './types';

export class FortySixElksSmsAdapter
  implements ProviderAdapter<FortySixElksAdapterConfig, FortySixElksApiRequest, FortySixElksApiResponse>
{
  readonly id = 'forty-six-elks';
  readonly name = 'FortySixElks';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: FortySixElksAdapterConfig;

  constructor(config?: FortySixElksAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: FortySixElksAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.username && config.password);
  }

  transformRequest(options: ProviderSendOptions, config?: FortySixElksAdapterConfig): FortySixElksApiRequest {
    return fortySixElksTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: FortySixElksApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return fortySixElksTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: FortySixElksAdapterConfig): Promise<ProviderSendResult> {
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
      const response = await providerFetch(config.baseUrl || 'https://api.46elks.com/a1/sms', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}` },
        body: new URLSearchParams({ from: reqPayload.from || '', to: reqPayload.to, message: reqPayload.text }),
      });
      const responseText = await response.text();
      let responseJson: Record<string, unknown> = {};
      try {
        responseJson = JSON.parse(responseText) || {};
      } catch {
        /* Some providers return a documented text acknowledgement. */
      }

      if (response.ok && responseJson.id && ['created', 'sent', 'delivered'].includes(String(responseJson.status)))
        return { success: true, providerMessageId: String(responseJson.id) };
      return {
        success: false,
        error: {
          code: 'FORTY_SIX_ELKS_SEND_ERROR',
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
    const webhookData = payload as FortySixElksWebhookPayload;
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
