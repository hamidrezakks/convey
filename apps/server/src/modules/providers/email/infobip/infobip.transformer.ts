import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { InfobipEmailAdapterConfig, InfobipEmailApiRequest, InfobipEmailApiResponse } from './types';

export class InfobipEmailTransformer
  implements ProviderTransformer<InfobipEmailAdapterConfig, InfobipEmailApiRequest, InfobipEmailApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: InfobipEmailAdapterConfig): InfobipEmailApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const from = options.from || config?.from || 'no-reply@example.com';

    return {
      from,
      to,
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
    };
  }

  transformResponse(response: InfobipEmailApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const firstMsg = response.messages?.[0];
    if (statusCode >= 200 && statusCode < 300 && firstMsg?.messageId) {
      return {
        success: true,
        providerMessageId: firstMsg.messageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: firstMsg?.status?.name || 'INFOBIP_EMAIL_ERROR',
        message:
          response.requestError?.serviceException?.text ||
          firstMsg?.status?.description ||
          'Infobip Email API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const infobipEmailTransformer = new InfobipEmailTransformer();
