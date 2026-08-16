import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { MailjetApiRequest, MailjetApiResponse, MailjetEmailAdapterConfig } from './types';

export class MailjetTransformer
  implements ProviderTransformer<MailjetEmailAdapterConfig, MailjetApiRequest, MailjetApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MailjetEmailAdapterConfig): MailjetApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: toList.map((Email) => ({ Email })),
          Subject: (options.content.subject as string) || 'No Subject',
          TextPart: options.content.text as string | undefined,
          HTMLPart: (options.content.html || options.content.body) as string | undefined,
          TemplateID: options.content.templateId ? Number(options.content.templateId) : undefined,
          TemplateLanguage: Boolean(options.content.templateId),
          Variables: options.content.variables as Record<string, unknown> | undefined,
        },
      ],
    };
  }

  transformResponse(response: MailjetApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const firstMsg = response.Messages?.[0];
    const msgId = firstMsg?.To?.[0]?.MessageID;

    if (statusCode >= 200 && statusCode < 300 && firstMsg?.Status === 'success' && msgId != null) {
      return {
        success: true,
        providerMessageId: String(msgId),
        metadata: { rawPayload: rawBody || response },
      };
    }

    const firstErr = firstMsg?.Errors?.[0];
    return {
      success: false,
      error: {
        code: String(firstErr?.ErrorCode || 'MAILJET_ERROR'),
        message: firstErr?.ErrorMessage || response.ErrorMessage || 'Mailjet v3.1 API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const mailjetTransformer = new MailjetTransformer();
