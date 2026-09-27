import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { NetcoreApiRequest, NetcoreApiResponse, NetcoreEmailAdapterConfig } from './types';

export class NetcoreTransformer
  implements ProviderTransformer<NetcoreEmailAdapterConfig, NetcoreApiRequest, NetcoreApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: NetcoreEmailAdapterConfig): NetcoreApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    const content: Array<{ type: 'html' | 'text'; value: string }> = [];
    if (options.content.html || options.content.body) {
      content.push({ type: 'html', value: (options.content.html || options.content.body) as string });
    }
    if (options.content.text) {
      content.push({ type: 'text', value: options.content.text as string });
    }
    if (content.length === 0) {
      content.push({ type: 'text', value: '' });
    }

    return {
      from: { email: fromEmail, name: fromName },
      subject: (options.content.subject as string) || 'No Subject',
      content,
      personalizations: [
        {
          to: toList.map((email) => ({ email })),
        },
      ],
    };
  }

  transformResponse(response: NetcoreApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.data?.message_id;
    if (statusCode >= 200 && statusCode < 300 && (response.status === 'success' || msgId)) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETCORE_ERROR',
        message: response.message || 'Netcore Email API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const netcoreTransformer = new NetcoreTransformer();
