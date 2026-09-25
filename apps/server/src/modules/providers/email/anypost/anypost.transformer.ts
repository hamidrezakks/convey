import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { AnypostApiRequest, AnypostApiResponse, AnypostEmailAdapterConfig } from './types';

export class AnypostTransformer
  implements ProviderTransformer<AnypostEmailAdapterConfig, AnypostApiRequest, AnypostApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: AnypostEmailAdapterConfig): AnypostApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo : (rawTo as string) || '';

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      to,
      from: fromName ? { email: fromEmail, name: fromName } : fromEmail,
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
      templateId: options.content.templateId as string | undefined,
      variables: options.content.variables as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: AnypostApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const messageId = response.id || response.messageId;
    if (statusCode >= 200 && statusCode < 300 && (response.status === 'success' || messageId)) {
      return {
        success: true,
        providerMessageId: messageId || `anypost_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'ANYPOST_ERROR',
        message: response.error || 'Anypost Email API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const anypostTransformer = new AnypostTransformer();
