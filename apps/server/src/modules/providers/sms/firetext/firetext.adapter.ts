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
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: FiretextAdapterConfig;

  constructor(config?: FiretextAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: FiretextAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: FiretextAdapterConfig): FiretextApiRequest {
    return firetextTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: FiretextApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return firetextTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: FiretextAdapterConfig): Promise<ProviderSendResult> {
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
      const response = await providerFetch(config.baseUrl || 'https://www.firetext.co.uk/api/sendsms', {
        method: 'POST',
        headers: {},
        body: new URLSearchParams({
          apiKey: config.apiKey || '',
          from: reqPayload.from || '',
          to: reqPayload.to,
          message: reqPayload.text,
        }),
      });
      const responseText = await response.text();
      let responseJson: Record<string, unknown> = {};
      try {
        responseJson = JSON.parse(responseText) || {};
      } catch {
        /* Some providers return a documented text acknowledgement. */
      }

      if (response.ok && responseText.startsWith('0:'))
        return { success: true, providerMessageId: response.headers.get('X-Message') || undefined };
      return {
        success: false,
        error: {
          code: 'FIRETEXT_SEND_ERROR',
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
