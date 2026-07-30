import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { CequensApiRequest, CequensApiResponse, CequensSmsAdapterConfig } from './types';

export class CequensSmsTransformer
  implements ProviderTransformer<CequensSmsAdapterConfig, CequensApiRequest, CequensApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: CequensSmsAdapterConfig): CequensApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const sender = options.from || options.senderName || config?.senderName || config?.from || 'Convey';

    const message = (options.content.text || options.content.body || '') as string;

    return {
      recipient,
      sender,
      message,
      clientRefId: (options.metadata?.clientRefId as string) || undefined,
    };
  }

  transformResponse(response: CequensApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const messageId =
      response.message_id || (response.data?.messageId != null ? String(response.data.messageId) : undefined);

    const isSuccess =
      statusCode >= 200 &&
      statusCode < 300 &&
      (response.status === 'accepted' || response.replyCode === 0 || Boolean(messageId));

    if (isSuccess && messageId) {
      return {
        success: true,
        providerMessageId: messageId,
        metadata: {
          status: response.status || 'accepted',
          rawPayload: rawBody || response,
        },
      };
    }

    return {
      success: false,
      error: {
        code: response.replyCode ? String(response.replyCode) : 'CEQUENS_SEND_FAILED',
        message: response.replyMessage || response.status || 'Failed to send SMS via Cequens API',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: {
        rawPayload: rawBody || response,
      },
    };
  }
}

export const cequensTransformer = new CequensSmsTransformer();
