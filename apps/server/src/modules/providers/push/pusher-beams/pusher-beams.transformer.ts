import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PusherBeamsApiRequest, PusherBeamsApiResponse, PusherBeamsPushAdapterConfig } from './types';

export class PusherBeamsTransformer
  implements ProviderTransformer<PusherBeamsPushAdapterConfig, PusherBeamsApiRequest, PusherBeamsApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: PusherBeamsPushAdapterConfig): PusherBeamsApiRequest {
    const subscriberId = options.recipient.subscriberId;
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const interest = typeof options.recipient.to === 'string' ? options.recipient.to : undefined;

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    const notification = { title, body, sound: options.content.sound || 'default', badge: options.content.badge };

    const req: PusherBeamsApiRequest = {
      apns: { aps: { alert: notification, badge: options.content.badge, sound: options.content.sound } },
      fcm: { notification, data: options.content.data as Record<string, unknown> | undefined },
      web: { notification },
    };

    if (subscriberId) {
      req.users = [subscriberId];
    } else if (Array.isArray(tokens) && tokens.length > 0) {
      req.interests = tokens;
    } else if (interest) {
      req.interests = [interest];
    }

    return req;
  }

  transformResponse(response: PusherBeamsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.publishId) {
      return {
        success: true,
        providerMessageId: response.publishId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'PUSHER_BEAMS_ERROR',
        message: response.description || response.error || 'Pusher Beams Publish API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const pusherBeamsTransformer = new PusherBeamsTransformer();
