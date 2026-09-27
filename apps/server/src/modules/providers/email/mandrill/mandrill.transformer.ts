import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { MandrillApiRequest, MandrillApiResponse, MandrillEmailAdapterConfig } from './types';

export class MandrillTransformer
  implements ProviderTransformer<MandrillEmailAdapterConfig, MandrillApiRequest, MandrillApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MandrillEmailAdapterConfig): MandrillApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      key: config?.apiKey || '',
      message: {
        from_email: fromEmail,
        from_name: fromName,
        to: toList.map((email) => ({ email, type: 'to' })),
        subject: (options.content.subject as string) || 'No Subject',
        text: options.content.text as string | undefined,
        html: (options.content.html || options.content.body) as string | undefined,
      },
    };
  }

  transformResponse(response: MandrillApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const firstRes = Array.isArray(response) ? response[0] : undefined;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      firstRes?._id &&
      (firstRes.status === 'sent' || firstRes.status === 'queued')
    ) {
      return {
        success: true,
        providerMessageId: firstRes._id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: firstRes?.reject_reason || firstRes?.status || 'MANDRILL_ERROR',
        message: firstRes?.reject_reason
          ? `Mandrill send rejected: ${firstRes.reject_reason}`
          : 'Mandrill API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const mandrillTransformer = new MandrillTransformer();
