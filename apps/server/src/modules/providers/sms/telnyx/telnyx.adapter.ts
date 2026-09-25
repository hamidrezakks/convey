import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { telnyxTransformer } from './telnyx.transformer';
import type { TelnyxAdapterConfig, TelnyxApiRequest, TelnyxApiResponse, TelnyxWebhookPayload } from './types';

export class TelnyxSmsAdapter implements ProviderAdapter<TelnyxAdapterConfig, TelnyxApiRequest, TelnyxApiResponse> {
  readonly id = 'telnyx';
  readonly name = 'Telnyx';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: TelnyxAdapterConfig;

  constructor(config?: TelnyxAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: TelnyxAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: TelnyxAdapterConfig): TelnyxApiRequest {
    return telnyxTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TelnyxApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return telnyxTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: TelnyxAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider configuration is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Telnyx',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.baseUrl || 'https://api.telnyx.com/v2/messages';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: TelnyxApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as TelnyxApiResponse;
      } catch {
        responseJson = { errors: [{ detail: responseText }] };
      }

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const webhookData = payload as TelnyxWebhookPayload;
    const msgId = webhookData.data?.payload?.id || webhookData.data?.id;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    if (webhookData.data?.event_type !== 'message.finalized') return [];
    const status = (webhookData.data?.payload?.to?.[0]?.status || '').toLowerCase();
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
