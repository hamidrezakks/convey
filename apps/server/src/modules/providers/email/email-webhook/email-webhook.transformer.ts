import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { EmailWebhookAdapterConfig, EmailWebhookApiRequest, EmailWebhookApiResponse } from './types';

export class EmailWebhookTransformer
  implements ProviderTransformer<EmailWebhookAdapterConfig, EmailWebhookApiRequest, EmailWebhookApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: EmailWebhookAdapterConfig): EmailWebhookApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo : (rawTo as string) || '';

    return {
      to,
      from: options.from || 'no-reply@example.com',
      subject: (options.content.subject as string) || 'No Subject',
      html: options.content.html as string | undefined,
      text: (options.content.text || options.content.body) as string | undefined,
      templateId: options.content.templateId as string | undefined,
      variables: options.content.variables as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: EmailWebhookApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.messageId || response.id;
    if (statusCode >= 200 && statusCode < 300 && response.success !== false) {
      return {
        success: true,
        providerMessageId: msgId || `webhook_email_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'WEBHOOK_EMAIL_ERROR',
        message: response.error || 'Email Webhook endpoint returned error',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const emailWebhookTransformer = new EmailWebhookTransformer();
