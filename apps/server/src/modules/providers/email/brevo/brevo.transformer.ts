import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { BrevoApiRequest, BrevoApiResponse, BrevoEmailAdapterConfig } from './types';

export class BrevoTransformer
  implements ProviderTransformer<BrevoEmailAdapterConfig, BrevoApiRequest, BrevoApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: BrevoEmailAdapterConfig): BrevoApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      sender: { email: fromEmail, name: fromName },
      to: toList.map((email) => ({ email })),
      subject: (options.content.subject as string) || 'No Subject',
      textContent: options.content.text as string | undefined,
      htmlContent: (options.content.html || options.content.body) as string | undefined,
      templateId: options.content.templateId ? Number(options.content.templateId) : undefined,
      params: options.content.variables as Record<string, unknown> | undefined,
      replyTo: options.replyTo ? { email: options.replyTo } : undefined,
    };
  }

  transformResponse(response: BrevoApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    const messageId = response.messageId || response.messageIds?.[0];
    if (statusCode >= 200 && statusCode < 300 && messageId) {
      return {
        success: true,
        providerMessageId: messageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code || 'BREVO_ERROR',
        message: response.message || 'Brevo SMTP API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const brevoTransformer = new BrevoTransformer();
