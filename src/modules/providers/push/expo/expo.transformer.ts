import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ExpoApiRequest, ExpoApiResponse, ExpoPushAdapterConfig } from './types';

export class ExpoTransformer implements ProviderTransformer<ExpoPushAdapterConfig, ExpoApiRequest, ExpoApiResponse> {
  transformRequest(options: ProviderSendOptions, _config?: ExpoPushAdapterConfig): ExpoApiRequest {
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const to = Array.isArray(tokens) ? tokens : (options.recipient.to as string) || '';

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    return [
      {
        to,
        title,
        body,
        sound: options.content.sound === 'none' ? null : 'default',
        badge: options.content.badge,
        data: options.content.data as Record<string, unknown> | undefined,
      },
    ];
  }

  transformResponse(response: ExpoApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const firstTicket = response.data?.[0];

    if (statusCode >= 200 && statusCode < 300 && firstTicket?.status === 'ok') {
      return {
        success: true,
        providerMessageId: firstTicket.id || `expo_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    const _firstErr = response.errors?.[0] || firstTicket?.details;
    return {
      success: false,
      error: {
        code: (firstTicket?.details?.error as string) || response.errors?.[0]?.code || 'EXPO_ERROR',
        message: firstTicket?.message || response.errors?.[0]?.message || 'Expo Push Notification API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const expoTransformer = new ExpoTransformer();
