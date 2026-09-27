import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PostmarkApiRequest, PostmarkApiResponse, PostmarkEmailAdapterConfig } from './types';

export class PostmarkTransformer
  implements ProviderTransformer<PostmarkEmailAdapterConfig, PostmarkApiRequest, PostmarkApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: PostmarkEmailAdapterConfig): PostmarkApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo.join(',') : (rawTo as string) || '';

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName;
    const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    return {
      From: from,
      To: to,
      Subject: (options.content.subject as string) || 'No Subject',
      TextBody: options.content.text as string | undefined,
      HtmlBody: (options.content.html || options.content.body) as string | undefined,
      ReplyTo: options.replyTo,
    };
  }

  transformResponse(response: PostmarkApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      response.MessageID &&
      (response.ErrorCode === 0 || !response.ErrorCode)
    ) {
      return {
        success: true,
        providerMessageId: response.MessageID,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.ErrorCode ? String(response.ErrorCode) : 'POSTMARK_ERROR',
        message: response.Message || 'Postmark Email API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const postmarkTransformer = new PostmarkTransformer();
