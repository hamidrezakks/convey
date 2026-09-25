import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { SendgridApiRequest, SendgridApiResponse, SendgridEmailAdapterConfig } from './types';

export class SendgridTransformer
  implements ProviderTransformer<SendgridEmailAdapterConfig, SendgridApiRequest, SendgridApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: SendgridEmailAdapterConfig): SendgridApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    const contentItems: Array<{ type: string; value: string }> = [];
    if (options.content.text) {
      contentItems.push({ type: 'text/plain', value: options.content.text as string });
    }
    if (options.content.html) {
      contentItems.push({ type: 'text/html', value: options.content.html as string });
    }
    if (contentItems.length === 0) {
      contentItems.push({ type: 'text/plain', value: (options.content.body as string) || '' });
    }

    return {
      personalizations: [
        {
          to: toList.map((e) => ({ email: e })),
        },
      ],
      from: { email: fromEmail, name: fromName },
      subject: (options.content.subject as string) || 'No Subject',
      content: contentItems,
      ip_pool_name: config?.ipPoolName,
    };
  }

  transformResponse(
    response: SendgridApiResponse,
    statusCode = 202,
    headers?: Record<string, string>,
  ): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      const msgIdHeader = headers?.['x-message-id'] || headers?.['X-Message-Id'];
      return {
        success: true,
        providerMessageId: msgIdHeader || `sg_${Date.now()}`,
      };
    }

    const firstErr = response?.errors?.[0];
    return {
      success: false,
      error: {
        code: statusCode === 401 ? 'UNAUTHORIZED' : 'SENDGRID_ERROR',
        message: firstErr?.message || 'SendGrid API request failed',
        category: httpErrorCategory(statusCode),
      },
    };
  }
}

export const sendgridTransformer = new SendgridTransformer();
