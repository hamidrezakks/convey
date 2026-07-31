import { parseFetchResponse } from '../../../../utils/http';
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
import { cequensWhatsappTransformer } from './cequens-whatsapp.transformer';
import type {
  CequensWhatsappAdapterConfig,
  CequensWhatsappApiRequest,
  CequensWhatsappApiResponse,
  CequensWhatsappWebhookPayload,
} from './types';

export class CequensWhatsappChatAdapter
  implements ProviderAdapter<CequensWhatsappAdapterConfig, CequensWhatsappApiRequest, CequensWhatsappApiResponse>
{
  readonly id = 'cequens-whatsapp';
  readonly name = 'Cequens WhatsApp';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: CequensWhatsappAdapterConfig;

  constructor(config?: CequensWhatsappAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: CequensWhatsappAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: CequensWhatsappAdapterConfig): CequensWhatsappApiRequest {
    return cequensWhatsappTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: CequensWhatsappApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return cequensWhatsappTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: CequensWhatsappAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.recipientPhone) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Cequens WhatsApp',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Cequens API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://apis.cequens.com/whatsapp/v1/messages';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const { statusCode, json, text } = await parseFetchResponse<CequensWhatsappApiResponse>(response);
      const responseJson = json && Object.keys(json).length > 0 ? json : { replyMessage: text };
      return this.transformResponse(responseJson, statusCode, text);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as CequensWhatsappWebhookPayload;
    if (!webhookData?.messageId) return [];

    const isInbound = Boolean(webhookData.direction === 'inbound' || webhookData.senderPhone);

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.status || '').toLowerCase();
    if (status === 'read') normalizedStatus = NormalizedStatus.READ;
    else if (status === 'failed') normalizedStatus = NormalizedStatus.FAILED;

    const rawPayloadObj =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : { raw: payload };

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus,
        rawPayload: {
          ...rawPayloadObj,
          ...(isInbound ? { isInboundUserMessage: true, senderPhone: webhookData.senderPhone } : {}),
        },
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
