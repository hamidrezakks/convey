import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ResendApiRequest, ResendApiResponse, ResendEmailAdapterConfig } from './types';

export class ResendTransformer
  implements ProviderTransformer<ResendEmailAdapterConfig, ResendApiRequest, ResendApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: ResendEmailAdapterConfig): ResendApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo : (rawTo as string) || '';

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    return {
      from,
      to,
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
      reply_to: options.replyTo,
    };
  }

  transformResponse(response: ResendApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id) {
      return {
        success: true,
        providerMessageId: response.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.name || 'RESEND_ERROR',
        message: response.message || 'Resend API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const resendTransformer = new ResendTransformer();
