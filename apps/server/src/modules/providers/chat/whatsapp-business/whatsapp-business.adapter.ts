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
import {
  type WhatsappApiRequest,
  type WhatsappApiResponse,
  type WhatsappBusinessChatAdapterConfig,
  type WhatsappWebhookPayload,
  WhatsappWebhookStatusType,
} from './types';
import { whatsappBusinessTransformer } from './whatsapp-business.transformer';

export type WhatsappIncomingMessage = NonNullable<
  NonNullable<NonNullable<NonNullable<WhatsappWebhookPayload['entry']>[number]['changes']>[number]['value']>['messages']
>[number];

export function extractWhatsappMessageBody(incomingMsg?: WhatsappIncomingMessage): string {
  if (!incomingMsg) return '';
  if (incomingMsg.text?.body) {
    return incomingMsg.text.body;
  }
  if (incomingMsg.interactive?.button_reply?.title) {
    return incomingMsg.interactive.button_reply.title;
  }
  if (incomingMsg.interactive?.list_reply?.title) {
    return incomingMsg.interactive.list_reply.title;
  }
  if (incomingMsg.button?.text) {
    return incomingMsg.button.text;
  }
  return '';
}

export class WhatsappBusinessChatAdapter
  implements ProviderAdapter<WhatsappBusinessChatAdapterConfig, WhatsappApiRequest, WhatsappApiResponse>
{
  readonly id = 'whatsapp-business';
  readonly name = 'WhatsApp Business';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: WhatsappBusinessChatAdapterConfig;

  constructor(config?: WhatsappBusinessChatAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: WhatsappBusinessChatAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.phoneNumberId && config.accessToken);
  }

  transformRequest(options: ProviderSendOptions, config?: WhatsappBusinessChatAdapterConfig): WhatsappApiRequest {
    return whatsappBusinessTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: WhatsappApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return whatsappBusinessTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(
    options: ProviderSendOptions,
    configOverride?: WhatsappBusinessChatAdapterConfig,
  ): Promise<ProviderSendResult> {
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
    const phoneNumberId = config.phoneNumberId || '';
    const accessToken = config.accessToken || '';
    const baseUrl = config.baseUrl || 'https://graph.facebook.com';
    const apiVersion = config.apiVersion || 'v18.0';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for WhatsApp Business',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!phoneNumberId || !accessToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'WhatsApp phoneNumberId or accessToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `${baseUrl}/${apiVersion}/${phoneNumberId}/messages`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: WhatsappApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as WhatsappApiResponse;
      } catch {
        responseJson = { error: { message: responseText, type: 'ParseError', code: 500 } };
      }

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  /**
   * Parse incoming webhook payloads, supporting batch statuses and inbound customer messages.
   */
  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const events: NormalizedWebhookEvent[] = [];
    const webhookData = payload as WhatsappWebhookPayload;
    const entries = webhookData?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // 1. Process Delivery & Read Receipts
        const statuses = value.statuses || [];
        for (const statusObj of statuses) {
          if (!statusObj?.id) continue;

          let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
          if (statusObj.status === WhatsappWebhookStatusType.READ || statusObj.status === 'read') {
            normalizedStatus = NormalizedStatus.READ;
          } else if (statusObj.status === WhatsappWebhookStatusType.FAILED || statusObj.status === 'failed') {
            normalizedStatus = NormalizedStatus.FAILED;
          }

          if (!['delivered', 'read', 'failed'].includes(statusObj.status || '')) continue;
          events.push({
            providerId: this.id,
            providerMessageId: statusObj.id,
            normalizedStatus,
            rawPayload: payload,
            timestamp: statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date(),
          });
        }

        // 2. Process Inbound Customer Messages
        const messages = value.messages || [];
        for (const incomingMsg of messages) {
          if (!incomingMsg?.from || !incomingMsg.id) continue;

          const messageBody = extractWhatsappMessageBody(incomingMsg);

          events.push({
            providerId: this.id,
            providerMessageId: incomingMsg.id,
            normalizedStatus: NormalizedStatus.DELIVERED,
            rawPayload: {
              ...(typeof payload === 'object' && payload !== null ? payload : { raw: payload }),
              isInboundUserMessage: true,
              senderPhone: incomingMsg.from,
              body: messageBody,
              text: messageBody,
              messageType: incomingMsg.type || 'text',
            },
            timestamp: incomingMsg.timestamp ? new Date(Number(incomingMsg.timestamp) * 1000) : new Date(),
          });
        }
      }
    }

    return events;
  }
}
