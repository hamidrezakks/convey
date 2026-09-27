import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PushpadApiRequest, PushpadApiResponse, PushpadPushAdapterConfig } from './types';

export class PushpadTransformer
  implements ProviderTransformer<PushpadPushAdapterConfig, PushpadApiRequest, PushpadApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: PushpadPushAdapterConfig): PushpadApiRequest {
    const subscriberId = options.recipient.subscriberId;
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const singleTo = typeof options.recipient.to === 'string' ? options.recipient.to : undefined;

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    const req: PushpadApiRequest = {
      title,
      body,
      custom_data: options.content.data as Record<string, unknown> | undefined,
    };

    if (subscriberId) {
      req.uids = [subscriberId];
    } else if (Array.isArray(tokens) && tokens.length > 0) {
      req.uids = tokens;
    } else if (singleTo) {
      req.uids = [singleTo];
    }

    return req;
  }

  transformResponse(response: PushpadApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id != null) {
      return {
        success: true,
        providerMessageId: String(response.id),
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'PUSHPAD_ERROR',
        message: response.error || 'Pushpad Notification API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const pushpadTransformer = new PushpadTransformer();
