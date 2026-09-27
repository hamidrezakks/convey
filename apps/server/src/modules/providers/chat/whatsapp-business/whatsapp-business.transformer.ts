import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import {
  type WhatsappApiRequest,
  type WhatsappApiResponse,
  type WhatsappBusinessChatAdapterConfig,
  WhatsappMessageType,
  WhatsappMessagingProduct,
  WhatsappRecipientType,
} from './types';

export class WhatsappBusinessTransformer
  implements ProviderTransformer<WhatsappBusinessChatAdapterConfig, WhatsappApiRequest, WhatsappApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: WhatsappBusinessChatAdapterConfig): WhatsappApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const body = (options.content.text || options.content.body || '') as string;
    const templateName = options.content.templateId as string | undefined;

    if (templateName) {
      return {
        messaging_product: WhatsappMessagingProduct.WHATSAPP,
        recipient_type: WhatsappRecipientType.INDIVIDUAL,
        to,
        type: WhatsappMessageType.TEMPLATE,
        template: {
          name: templateName,
          language: { code: 'en_US' },
        },
      };
    }

    return {
      messaging_product: WhatsappMessagingProduct.WHATSAPP,
      recipient_type: WhatsappRecipientType.INDIVIDUAL,
      to,
      type: WhatsappMessageType.TEXT,
      text: { body },
    };
  }

  transformResponse(response: WhatsappApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.messages?.[0]?.id;

    if (statusCode >= 200 && statusCode < 300 && msgId) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.error?.code ? String(response.error.code) : 'WHATSAPP_ERROR',
        message: response.error?.message || 'WhatsApp Cloud API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const whatsappBusinessTransformer = new WhatsappBusinessTransformer();
