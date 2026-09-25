import { parseFetchResponse } from '../../../../utils/http';
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
import { cequensWhatsappTransformer } from './cequens-whatsapp.transformer';
import type {
  CequensWhatsappAdapterConfig,
  CequensWhatsappApiRequest,
  CequensWhatsappApiResponse,
  CequensWhatsappWebhookPayload,
} from './types';

export function normalizeCequensStatus(status?: string): NormalizedStatus {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'read':
    case 'seen':
      return NormalizedStatus.READ;
    case 'failed':
    case 'undelivered':
    case 'rejected':
    case 'expired':
    case 'error':
      return NormalizedStatus.FAILED;
    case 'bounced':
      return NormalizedStatus.BOUNCED;
    case 'opened':
      return NormalizedStatus.OPENED;
    default:
      return NormalizedStatus.DELIVERED;
  }
}

export function extractCequensMessageBody(
  payload: CequensWhatsappWebhookPayload,
  rawObj: Record<string, unknown>,
): string {
  return (
    payload.text ||
    (rawObj.text as string) ||
    (rawObj.body as string) ||
    (rawObj.messageText as string) ||
    (rawObj.message as string) ||
    ''
  );
}

export function parseCequensTimestamp(timestamp?: string | number): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'number') {
    return new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
  }
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

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
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: CequensWhatsappAdapterConfig): CequensWhatsappApiRequest {
    return cequensWhatsappTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: CequensWhatsappApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return cequensWhatsappTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: CequensWhatsappAdapterConfig): Promise<ProviderSendResult> {
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
      const response = await providerFetch(endpoint, {
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
    if (!payload || typeof payload !== 'object') return [];
    const rawPayloadObj =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : { raw: payload };
    const webhookData = payload as CequensWhatsappWebhookPayload;

    const messageId =
      webhookData?.messageId ||
      (rawPayloadObj.id as string) ||
      (rawPayloadObj.message_id as string) ||
      (rawPayloadObj.msgId as string);

    if (!messageId) return [];

    const direction = (webhookData?.direction || (rawPayloadObj.direction as string) || '').toLowerCase();
    const senderPhone =
      webhookData?.senderPhone ||
      (rawPayloadObj.senderPhone as string) ||
      (rawPayloadObj.from as string) ||
      (rawPayloadObj.sender as string);

    const isInbound = Boolean(direction === 'inbound' || senderPhone);
    const normalizedStatus = normalizeCequensStatus(webhookData?.status || (rawPayloadObj.status as string));
    if (
      !isInbound &&
      ![
        'delivered',
        'read',
        'seen',
        'failed',
        'undelivered',
        'rejected',
        'expired',
        'error',
        'bounced',
        'opened',
      ].includes(String(webhookData?.status || rawPayloadObj.status || '').toLowerCase())
    )
      return [];
    const bodyText = extractCequensMessageBody(webhookData || {}, rawPayloadObj);

    return [
      {
        providerId: this.id,
        providerMessageId: messageId,
        normalizedStatus,
        rawPayload: {
          ...rawPayloadObj,
          ...(isInbound && {
            isInboundUserMessage: true,
            senderPhone,
            body: bodyText,
            text: bodyText,
          }),
        },
        timestamp: parseCequensTimestamp(webhookData?.timestamp || (rawPayloadObj.timestamp as string | number)),
      },
    ];
  }
}
