import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { SesApiRequest, SesApiResponse, SesEmailAdapterConfig } from './types';

export class SesTransformer implements ProviderTransformer<SesEmailAdapterConfig, SesApiRequest, SesApiResponse> {
  transformRequest(options: ProviderSendOptions, config?: SesEmailAdapterConfig): SesApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    return {
      FromEmailAddress: from,
      Destination: {
        ToAddresses: toList,
      },
      Content: {
        Simple: {
          Subject: { Data: (options.content.subject as string) || 'No Subject' },
          Body: {
            Html: options.content.html
              ? { Data: options.content.html as string }
              : options.content.body
                ? { Data: options.content.body as string }
                : undefined,
            Text: options.content.text ? { Data: options.content.text as string } : undefined,
          },
        },
      },
    };
  }

  transformResponse(response: SesApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.MessageId) {
      return {
        success: true,
        providerMessageId: response.MessageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'SES_ERROR',
        message: response.message || 'AWS SES v2 API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const sesTransformer = new SesTransformer();
