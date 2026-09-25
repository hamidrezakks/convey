import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { createTransportFetch } from '../../core/transport';
import { twilioTransformer } from './twilio.transformer';
import type { TwilioAdapterConfig, TwilioApiRequest, TwilioApiResponse, TwilioWebhookPayload } from './types';

export class TwilioSmsAdapter implements ProviderAdapter<TwilioAdapterConfig, TwilioApiRequest, TwilioApiResponse> {
  readonly id = 'twilio';
  readonly name = 'Twilio SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: TwilioAdapterConfig;

  constructor(config?: TwilioAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: TwilioAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.accountSid && config.authToken);
  }

  transformRequest(options: ProviderSendOptions, config?: TwilioAdapterConfig): TwilioApiRequest {
    return twilioTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TwilioApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return twilioTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: TwilioAdapterConfig): Promise<ProviderSendResult> {
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

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.To) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Twilio',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Twilio accountSid and authToken are required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const endpoint =
      config.baseUrl ||
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid || '')}/Messages.json`;
    const body = new URLSearchParams({ To: reqPayload.To, From: reqPayload.From, Body: reqPayload.Body });
    for (const media of reqPayload.MediaUrl || []) body.append('MediaUrl', media);
    if (reqPayload.StatusCallback) body.set('StatusCallback', reqPayload.StatusCallback);
    const transportFetch = createTransportFetch(config?.proxy);

    try {
      const response = await transportFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const responseText = await response.text();
      let responseJson: TwilioApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as TwilioApiResponse;
      } catch {
        responseJson = { message: responseText };
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
    const webhookData = payload as TwilioWebhookPayload;
    const msgId = webhookData.MessageSid || webhookData.SmsSid;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.MessageStatus || webhookData.SmsStatus || '').toLowerCase();
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
