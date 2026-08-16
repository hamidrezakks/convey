import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { SparkpostApiRequest, SparkpostApiResponse, SparkpostEmailAdapterConfig } from './types';

export class SparkpostTransformer
  implements ProviderTransformer<SparkpostEmailAdapterConfig, SparkpostApiRequest, SparkpostApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: SparkpostEmailAdapterConfig): SparkpostApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const toList: string[] = Array.isArray(rawTo) ? rawTo : [rawTo as string].filter(Boolean);

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName || config?.senderName;

    return {
      recipients: toList.map((email) => ({ address: { email } })),
      content: {
        from: { email: fromEmail, name: fromName },
        subject: (options.content.subject as string) || 'No Subject',
        text: options.content.text as string | undefined,
        html: (options.content.html || options.content.body) as string | undefined,
        template_id: options.content.templateId as string | undefined,
      },
    };
  }

  transformResponse(response: SparkpostApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.results?.id) {
      return {
        success: true,
        providerMessageId: response.results.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    const firstErr = response.errors?.[0];
    return {
      success: false,
      error: {
        code: firstErr?.code || 'SPARKPOST_ERROR',
        message: firstErr?.message || 'SparkPost Transmissions API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const sparkpostTransformer = new SparkpostTransformer();
