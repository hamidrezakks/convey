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
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: Sms77AdapterConfig;

  constructor(config?: Sms77AdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: Sms77AdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: Sms77AdapterConfig): Sms77ApiRequest {
    return sms77Transformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: Sms77ApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sms77Transformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: Sms77AdapterConfig): Promise<ProviderSendResult> {
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
      const response = await providerFetch(config.baseUrl || 'https://gateway.seven.io/api/sms', {
        method: 'POST',
        headers: { 'X-Api-Key': config.apiKey || '', Accept: 'application/json' },
        body: new URLSearchParams({ from: reqPayload.from || '', to: reqPayload.to, text: reqPayload.text }),
      });
      const responseText = await response.text();
      let responseJson: Record<string, unknown> = {};
      try {
        responseJson = JSON.parse(responseText) || {};
      } catch {
        /* Some providers return a documented text acknowledgement. */
      }
      const firstMessage = Array.isArray(responseJson.messages)
        ? (responseJson.messages[0] as { id?: string; success?: boolean })
        : undefined;
      if (response.ok && String(responseJson.success) === '100' && firstMessage?.success === true && firstMessage.id)
        return { success: true, providerMessageId: String(firstMessage?.id) };
      return {
        success: false,
        error: {
          code: 'SMS77_SEND_ERROR',
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
