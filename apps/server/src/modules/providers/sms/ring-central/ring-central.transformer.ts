import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { RingCentralAdapterConfig, RingCentralApiRequest, RingCentralApiResponse } from './types';

export class RingCentralTransformer
  implements ProviderTransformer<RingCentralAdapterConfig, RingCentralApiRequest, RingCentralApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: RingCentralAdapterConfig): RingCentralApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const recipientPhone = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const from = options.senderName || config?.from || config?.senderId;

    return {
      to: recipientPhone,
      from,
      text,
      mediaUrl: options.content.mediaUrl,
    };
  }

  transformResponse(response: RingCentralApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.id || response.messageId;

    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      (msgId || response.status === 'success' || response.statusCode === 200)
    ) {
      return {
        success: true,
        providerMessageId: msgId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `RING_CENTRAL_ERROR_${statusCode}`,
        message: response.message || response.error || 'RingCentral SMS API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const ringCentralTransformer = new RingCentralTransformer();
