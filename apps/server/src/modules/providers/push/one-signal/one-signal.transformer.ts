import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { OneSignalApiRequest, OneSignalApiResponse, OneSignalPushAdapterConfig } from './types';

export class OneSignalTransformer
  implements ProviderTransformer<OneSignalPushAdapterConfig, OneSignalApiRequest, OneSignalApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: OneSignalPushAdapterConfig): OneSignalApiRequest {
    const playerIds = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const subscriberId = options.recipient.subscriberId;
    const to = options.recipient.to;

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    const req: OneSignalApiRequest = {
      app_id: config?.appId || '',
      contents: { en: body },
      data: options.content.data as Record<string, unknown> | undefined,
    };

    if (title) {
      req.headings = { en: title };
    }

    if (Array.isArray(playerIds) && playerIds.length > 0) {
      req.include_player_ids = playerIds;
    } else if (subscriberId) {
      req.include_external_user_ids = [subscriberId];
    } else if (typeof to === 'string') {
      req.include_player_ids = [to];
    }

    return req;
  }

  transformResponse(response: OneSignalApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id && !response.errors) {
      return {
        success: true,
        providerMessageId: response.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    const errStr = Array.isArray(response.errors)
      ? response.errors.join(', ')
      : response.errors
        ? JSON.stringify(response.errors)
        : 'OneSignal Notification API request failed';

    return {
      success: false,
      error: {
        code: 'ONESIGNAL_ERROR',
        message: errStr,
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const oneSignalTransformer = new OneSignalTransformer();
