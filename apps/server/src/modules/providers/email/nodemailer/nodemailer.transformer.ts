import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { NodemailerEmailAdapterConfig, NodemailerMailOptions, NodemailerSendResult } from './types';

export class NodemailerTransformer
  implements ProviderTransformer<NodemailerEmailAdapterConfig, NodemailerMailOptions, NodemailerSendResult>
{
  transformRequest(options: ProviderSendOptions, config?: NodemailerEmailAdapterConfig): NodemailerMailOptions {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo : (rawTo as string) || '';

    const fromEmail = options.from || config?.from || 'no-reply@example.com';
    const fromName = options.senderName;
    const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    return {
      from,
      to,
      subject: (options.content.subject as string) || 'No Subject',
      text: options.content.text as string | undefined,
      html: (options.content.html || options.content.body) as string | undefined,
      replyTo: options.replyTo,
      attachments: options.content.attachments as
        | Array<{ filename: string; content: string | Buffer; contentType?: string }>
        | undefined,
    };
  }

  transformResponse(response: NodemailerSendResult, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.messageId && response.accepted?.length) {
      return {
        success: true,
        providerMessageId: response.messageId.replace(/[<>]/g, ''),
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'NODEMAILER_ERROR',
        message: 'Nodemailer transport send failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const nodemailerTransformer = new NodemailerTransformer();
