import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { FcmApiRequest, FcmApiResponse, FcmPushAdapterConfig } from './types';

export class FcmTransformer implements ProviderTransformer<FcmPushAdapterConfig, FcmApiRequest, FcmApiResponse> {
  transformRequest(options: ProviderSendOptions): FcmApiRequest {
    const tokens = options.recipient.fcmTokens || options.recipient.deviceTokens || [];
    const data = options.content.data;
    return {
      message: {
        token: tokens[0] || (typeof options.recipient.to === 'string' ? options.recipient.to : undefined),
        notification: {
          title: String(options.content.title || options.content.subject || ''),
          body: String(options.content.body || options.content.text || ''),
        },
        data: data
          ? Object.fromEntries(
              Object.entries(data).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : JSON.stringify(value),
              ]),
            )
          : undefined,
      },
    };
  }
  transformResponse(response: FcmApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode === 200 && response.name && !response.error) {
      return { success: true, providerMessageId: response.name, metadata: { rawPayload: rawBody || response } };
    }
    return {
      success: false,
      error: {
        code: response.error?.status || 'FCM_ERROR',
        message: response.error?.message || 'FCM HTTP v1 request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}
export const fcmTransformer = new FcmTransformer();
