import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { MailgunApiRequest, MailgunApiResponse, MailgunEmailAdapterConfig } from './types';

export class MailgunTransformer
  implements ProviderTransformer<MailgunEmailAdapterConfig, MailgunApiRequest, MailgunApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: MailgunEmailAdapterConfig): MailgunApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo.join(',') : (rawTo as string) || '';

    const fromEmail = options.from || 'no-reply@example.com';
    const fromName = options.senderName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    return {
      from,
      to,
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
      'h:Reply-To': options.replyTo,
      template: options.content.templateId as string | undefined,
      'v:variables': options.content.variables ? JSON.stringify(options.content.variables) : undefined,
    };
  }

  transformResponse(response: MailgunApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id) {
      return {
        success: true,
        providerMessageId: response.id.replace(/[<>]/g, ''),
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'MAILGUN_ERROR',
        message: response.message || 'Mailgun API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const mailgunTransformer = new MailgunTransformer();
