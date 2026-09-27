import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { AppioApiRequest, AppioApiResponse, AppioPushAdapterConfig } from './types';

export class AppioTransformer
  implements ProviderTransformer<AppioPushAdapterConfig, AppioApiRequest, AppioApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: AppioPushAdapterConfig): AppioApiRequest {
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const token = Array.isArray(tokens) ? tokens[0] : (options.recipient.to as string) || '';

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    return {
      app_id: config?.appId,
      token,
      title,
      body,
      data: options.content.data as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: AppioApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && (response.success !== false || response.message_id)) {
      return {
        success: true,
        providerMessageId: response.message_id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'APPIO_ERROR',
        message: response.error || 'Appio Push API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const appioTransformer = new AppioTransformer();
