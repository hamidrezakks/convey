import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ApnsApiRequest, ApnsApiResponse, ApnsPushAdapterConfig } from './types';

export class ApnsTransformer implements ProviderTransformer<ApnsPushAdapterConfig, ApnsApiRequest, ApnsApiResponse> {
  transformRequest(options: ProviderSendOptions, _config?: ApnsPushAdapterConfig): ApnsApiRequest {
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const token = Array.isArray(tokens) ? tokens[0] : (options.recipient.to as string) || '';

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    return {
      deviceToken: token,
      aps: {
        alert: { title, body },
        badge: options.content.badge,
        sound: options.content.sound || 'default',
        'mutable-content': 1,
      },
      data: options.content.data as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: ApnsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && (response.apnsId || statusCode === 200)) {
      return {
        success: true,
        providerMessageId: response.apnsId || `apns_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.reason || 'APNS_ERROR',
        message: response.reason || 'APNs HTTP/2 request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const apnsTransformer = new ApnsTransformer();
