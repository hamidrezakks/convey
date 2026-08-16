import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { TwilioWhatsappAdapterConfig, TwilioWhatsappApiRequest, TwilioWhatsappApiResponse } from './types';

export class TwilioWhatsappTransformer
  implements ProviderTransformer<TwilioWhatsappAdapterConfig, TwilioWhatsappApiRequest, TwilioWhatsappApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: TwilioWhatsappAdapterConfig): TwilioWhatsappApiRequest {
    const rawTo = options.recipient.whatsapp || options.recipient.phone || options.recipient.to;
    const phoneTo = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';
    const formattedTo = phoneTo.startsWith('whatsapp:') ? phoneTo : `whatsapp:${phoneTo}`;

    const rawFrom = options.from || config?.from || '';
    const formattedFrom = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

    const body = (options.content.text || options.content.body || options.content.title || '') as string;
    const templateId = (options.content.templateId || (options.content.data as Record<string, unknown>)?.contentSid) as
      | string
      | undefined;
    const vars = (options.content.variables || options.content.data || {}) as Record<string, unknown>;

    const req: TwilioWhatsappApiRequest = {
      From: formattedFrom,
      To: formattedTo,
      MediaUrl: options.content.mediaUrl,
    };

    if (templateId) {
      req.ContentSid = templateId;
      if (Object.keys(vars).length > 0) {
        req.ContentVariables = JSON.stringify(vars);
      }
    } else {
      req.Body = body;
    }

    return req;
  }

  transformResponse(response: TwilioWhatsappApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.sid) {
      return {
        success: true,
        providerMessageId: response.sid,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.error_code ? String(response.error_code) : 'TWILIO_WHATSAPP_ERROR',
        message: response.error_message || 'Twilio WhatsApp API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const twilioWhatsappTransformer = new TwilioWhatsappTransformer();
