import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { Outlook365ApiRequest, Outlook365ApiResponse, Outlook365EmailAdapterConfig } from './types';

export class Outlook365Transformer
  implements ProviderTransformer<Outlook365EmailAdapterConfig, Outlook365ApiRequest, Outlook365ApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: Outlook365EmailAdapterConfig): Outlook365ApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const isHtml = Boolean(options.content.html || options.content.body);
    const content = (options.content.html || options.content.body || options.content.text || '') as string;

    return {
      message: {
        subject: (options.content.subject as string) || 'No Subject',
        body: {
          contentType: isHtml ? 'HTML' : 'Text',
          content,
        },
        toRecipients: toList.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: false,
    };
  }

  transformResponse(response: Outlook365ApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: `outlook_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.error?.code || 'OUTLOOK365_ERROR',
        message: response.error?.message || 'Microsoft Graph API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const outlook365Transformer = new Outlook365Transformer();
