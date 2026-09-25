import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PushWebhookAdapterConfig, PushWebhookApiRequest, PushWebhookApiResponse } from './types';

export class PushWebhookTransformer
  implements ProviderTransformer<PushWebhookAdapterConfig, PushWebhookApiRequest, PushWebhookApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: PushWebhookAdapterConfig): PushWebhookApiRequest {
    const tokens = options.recipient.deviceTokens || options.recipient.fcmTokens;
    const target = Array.isArray(tokens) ? tokens : (options.recipient.to as string) || '';

    const title = (options.content.title || options.content.subject || '') as string;
    const body = (options.content.body || options.content.text || '') as string;

    return {
      target,
      title,
      body,
      sound: options.content.sound,
      badge: options.content.badge,
      data: options.content.data as Record<string, unknown> | undefined,
    };
  }

  transformResponse(response: PushWebhookApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.messageId || response.id;
    if (statusCode >= 200 && statusCode < 300 && response.success !== false) {
      return {
        success: true,
        providerMessageId: msgId || `push_webhook_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'PUSH_WEBHOOK_ERROR',
        message: response.error || 'Push Webhook endpoint request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const pushWebhookTransformer = new PushWebhookTransformer();
