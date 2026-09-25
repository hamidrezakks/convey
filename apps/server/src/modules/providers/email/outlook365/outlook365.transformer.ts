import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
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
        replyTo: options.replyTo ? [{ emailAddress: { address: options.replyTo } }] : undefined,
        attachments: options.content.attachments?.map((attachment) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: attachment.contentType || 'application/octet-stream',
          contentBytes: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString('base64')
            : Buffer.from(attachment.content).toString('base64'),
        })),
      },
      saveToSentItems: false,
    };
  }

  transformResponse(response: Outlook365ApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    if (statusCode === 202 && !response.error) {
      return {
        success: true,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.error?.code || 'OUTLOOK365_ERROR',
        message: response.error?.message || 'Microsoft Graph API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const outlook365Transformer = new Outlook365Transformer();
