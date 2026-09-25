import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { MailersendApiRequest, MailersendApiResponse, MailersendEmailAdapterConfig } from './types';

export class MailersendTransformer
  implements ProviderTransformer<MailersendEmailAdapterConfig, MailersendApiRequest, MailersendApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MailersendEmailAdapterConfig): MailersendApiRequest {
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
      template_id: options.content.templateId as string | undefined,
      reply_to: options.replyTo ? { email: options.replyTo } : undefined,
    };
  }

  transformResponse(
    response: MailersendApiResponse,
    statusCode = 222,
    headers?: Record<string, string>,
  ): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      const msgId = headers?.['x-message-id'] || headers?.['X-Message-Id'];
      return {
        success: true,
        providerMessageId: msgId || `mailersend_${Date.now()}`,
      };
    }

    return {
      success: false,
      error: {
        code: 'MAILERSEND_ERROR',
        message: response.message || 'MailerSend API request failed',
        category: httpErrorCategory(statusCode),
      },
    };
  }
}

export const mailersendTransformer = new MailersendTransformer();
