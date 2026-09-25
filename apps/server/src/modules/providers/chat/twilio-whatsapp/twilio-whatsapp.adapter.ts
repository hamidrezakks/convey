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
import { twilioWhatsappTransformer } from './twilio-whatsapp.transformer';
import type {
  TwilioWhatsappAdapterConfig,
  TwilioWhatsappApiRequest,
  TwilioWhatsappApiResponse,
  TwilioWhatsappWebhookPayload,
} from './types';

export class TwilioWhatsappChatAdapter
  implements ProviderAdapter<TwilioWhatsappAdapterConfig, TwilioWhatsappApiRequest, TwilioWhatsappApiResponse>
{
  readonly id = 'twilio-whatsapp';
  readonly name = 'Twilio WhatsApp';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: TwilioWhatsappAdapterConfig;

  constructor(config?: TwilioWhatsappAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: TwilioWhatsappAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.accountSid && config.authToken);
  }

  transformRequest(options: ProviderSendOptions, config?: TwilioWhatsappAdapterConfig): TwilioWhatsappApiRequest {
    return twilioWhatsappTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: TwilioWhatsappApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return twilioWhatsappTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: TwilioWhatsappAdapterConfig): Promise<ProviderSendResult> {
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
    const accountSid = config.accountSid || '';
    const authToken = config.authToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.To || reqPayload.To === 'whatsapp:') {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Twilio WhatsApp',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!accountSid || !authToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Twilio accountSid or authToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

    const formParams = new URLSearchParams();
    formParams.append('From', reqPayload.From);
    formParams.append('To', reqPayload.To);
    if (reqPayload.ContentSid) {
      formParams.append('ContentSid', reqPayload.ContentSid);
      if (reqPayload.ContentVariables) {
        formParams.append('ContentVariables', reqPayload.ContentVariables);
      }
    } else if (reqPayload.Body) {
      formParams.append('Body', reqPayload.Body);
    }
    if (reqPayload.MediaUrl) {
      for (const mediaUrl of reqPayload.MediaUrl) {
        formParams.append('MediaUrl', mediaUrl);
      }
    }

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      const responseText = await response.text();
      let responseJson: TwilioWhatsappApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as TwilioWhatsappApiResponse;
      } catch {
        responseJson = { error_message: responseText };
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
    const webhookData = payload as TwilioWhatsappWebhookPayload;
    const msgId = webhookData?.MessageSid || webhookData?.SmsSid;
    if (!msgId) return [];

    const status = (webhookData.MessageStatus || webhookData.SmsStatus || '').toLowerCase();
    const isInbound = Boolean(webhookData.From && (status === 'received' || !status || webhookData.Body));

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    if (status === 'read') normalizedStatus = NormalizedStatus.READ;
    else if (status === 'failed' || status === 'undelivered') normalizedStatus = NormalizedStatus.FAILED;
    else if (!isInbound && status !== 'delivered') return [];

    const rawPayloadObj =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : { raw: payload };

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: {
          ...rawPayloadObj,
          ...(isInbound
            ? {
                isInboundUserMessage: true,
                senderPhone: webhookData.From,
                body: webhookData.Body || '',
                text: webhookData.Body || '',
              }
            : {}),
        },
        timestamp: new Date(),
      },
    ];
  }
}
