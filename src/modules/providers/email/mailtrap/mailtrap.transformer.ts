import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { MailtrapApiRequest, MailtrapApiResponse, MailtrapEmailAdapterConfig } from './types';

export class MailtrapTransformer
  implements ProviderTransformer<MailtrapEmailAdapterConfig, MailtrapApiRequest, MailtrapApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MailtrapEmailAdapterConfig): MailtrapApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      from: { email: fromEmail, name: fromName },
      to: toList.map((email) => ({ email })),
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
      template_uuid: options.content.templateId as string | undefined,
      template_variables: options.content.variables as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: MailtrapApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.message_ids?.[0];
    if (statusCode >= 200 && statusCode < 300 && (response.success !== false || msgId)) {
      return {
        success: true,
        providerMessageId: msgId || `mailtrap_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'MAILTRAP_ERROR',
        message: response.errors?.join(', ') || 'Mailtrap Email API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const mailtrapTransformer = new MailtrapTransformer();
