import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { EmailjsApiRequest, EmailjsApiResponse, EmailjsEmailAdapterConfig } from './types';

export class EmailjsTransformer
  implements ProviderTransformer<EmailjsEmailAdapterConfig, EmailjsApiRequest, EmailjsApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: EmailjsEmailAdapterConfig): EmailjsApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toEmail = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const templateParams: Record<string, unknown> = {
      to_email: toEmail,
      from_email: options.from || 'no-reply@example.com',
      from_name: options.senderName,
      subject: options.content.subject || 'No Subject',
      message: options.content.text || options.content.html || options.content.body || '',
      ...((options.content.variables as Record<string, unknown>) || {}),
    };

    return {
      service_id: config?.serviceId || '',
      template_id: (options.content.templateId as string) || config?.templateId || '',
      user_id: config?.publicKey || '',
      accessToken: config?.privateKey,
      template_params: templateParams,
    };
  }

  transformResponse(response: EmailjsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: `emailjs_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'EMAILJS_ERROR',
        message: response.text || response.error || 'EmailJS request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const emailjsTransformer = new EmailjsTransformer();
