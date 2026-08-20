import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { BrazeEmailAdapterConfig, BrazeEmailApiRequest, BrazeEmailApiResponse } from './types';

export class BrazeEmailTransformer
  implements ProviderTransformer<BrazeEmailAdapterConfig, BrazeEmailApiRequest, BrazeEmailApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: BrazeEmailAdapterConfig): BrazeEmailApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const recipientEmail = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const fromEmail = options.from || 'no-reply@example.com';
    const apiKey = config?.apiKey || '';

    return {
      api_key: apiKey,
      messages: {
        email_message: {
          app_id: config?.appGroupKey,
          from: fromEmail,
          reply_to: options.replyTo,
          subject: (options.content.subject as string) || 'No Subject',
          body: (options.content.html || options.content.body || options.content.text || '') as string,
          recipient: {
            email: recipientEmail,
          },
        },
      },
    };
  }

  transformResponse(response: BrazeEmailApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.dispatch_id) {
      return {
        success: true,
        providerMessageId: response.dispatch_id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'BRAZE_ERROR',
        message: response.errors?.join(', ') || response.message || 'Braze Email API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const brazeEmailTransformer = new BrazeEmailTransformer();
