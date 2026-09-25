import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import {
  CequensMessageType,
  type CequensWhatsappAdapterConfig,
  type CequensWhatsappApiRequest,
  type CequensWhatsappApiResponse,
  type CequensWhatsappTemplateComponent,
  type CequensWhatsappTemplateParameter,
} from './types';

export class CequensWhatsappTransformer
  implements ProviderTransformer<CequensWhatsappAdapterConfig, CequensWhatsappApiRequest, CequensWhatsappApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: CequensWhatsappAdapterConfig): CequensWhatsappApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipientPhone = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const messageText = (options.content.text || options.content.body || options.content.title || '') as string;
    const templateName = options.content.templateId as string | undefined;
    const senderName = options.senderName || config?.senderId;
    const vars = (options.content.variables || options.content.data || {}) as Record<string, unknown>;
    const mediaUrls = options.content.mediaUrl;

    // 1. Template Message
    if (templateName) {
      const parameters: CequensWhatsappTemplateParameter[] = Object.values(vars).map((val) => ({
        type: 'text',
        text: String(val),
      }));

      const components: CequensWhatsappTemplateComponent[] = [];
      if (parameters.length > 0) {
        components.push({
          type: 'body',
          parameters,
        });
      }

      return {
        senderName,
        recipientPhone,
        messageType: CequensMessageType.TEMPLATE,
        templateName,
        templateLanguage: 'en',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: components.length > 0 ? components : undefined,
        },
        clientRef: config?.clientRef,
      };
    }

    // 2. Direct Media Message (without template)
    if (mediaUrls && mediaUrls.length > 0) {
      return {
        senderName,
        recipientPhone,
        messageType: CequensMessageType.MEDIA,
        mediaUrl: mediaUrls[0],
        media: { link: mediaUrls[0], caption: messageText || undefined },
        caption: messageText || undefined,
        messageText: messageText || undefined,
        clientRef: config?.clientRef,
      };
    }

    // 3. Direct Text Message (without template)
    return {
      senderName,
      recipientPhone,
      messageType: CequensMessageType.TEXT,
      messageText,
      text: { body: messageText },
      clientRef: config?.clientRef,
    };
  }

  transformResponse(response: CequensWhatsappApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.data?.messageId;

    if (statusCode >= 200 && statusCode < 300 && (response.replyCode === 0 || msgId)) {
      return {
        success: true,
        providerMessageId: msgId || `cequens_wa_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.replyCode ? `ERR_${response.replyCode}` : 'CEQUENS_WHATSAPP_ERROR',
        message: response.replyMessage || 'Cequens WhatsApp API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const cequensWhatsappTransformer = new CequensWhatsappTransformer();
