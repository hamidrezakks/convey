import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { FcmApiRequest, FcmApiResponse, FcmPushAdapterConfig } from './types';

export class FcmTransformer implements ProviderTransformer<FcmPushAdapterConfig, FcmApiRequest, FcmApiResponse> {
  transformRequest(options: ProviderSendOptions, _config?: FcmPushAdapterConfig): FcmApiRequest {
    const tokens =
      options.recipient.fcmTokens || (options.recipient.deviceTokens ? options.recipient.deviceTokens : []);
    const singleToken = typeof options.recipient.to === 'string' ? options.recipient.to : undefined;

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    const req: FcmApiRequest = {
      notification: {
        title,
        body,
      },
      data: options.content.data as Record<string, unknown> | undefined,
    };

    if (tokens.length > 1) {
      req.registration_ids = tokens;
    } else if (tokens.length === 1) {
      req.to = tokens[0];
    } else if (singleToken) {
      req.to = singleToken;
    }

    return req;
  }

  transformResponse(response: FcmApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const firstResult = response.results?.[0];
    const messageId = firstResult?.message_id || response.message_id;

    if (statusCode >= 200 && statusCode < 300 && (response.success || messageId)) {
      return {
        success: true,
        providerMessageId: messageId || `fcm_${Date.now()}`,
        metadata: {
          rawPayload: rawBody || response,
        },
      };
    }

    return {
      success: false,
      error: {
        code: firstResult?.error || response.error?.status || 'FCM_ERROR',
        message: response.error?.message || firstResult?.error || 'FCM legacy / HTTP API call failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: {
        rawPayload: rawBody || response,
      },
    };
  }
}

export const fcmTransformer = new FcmTransformer();
