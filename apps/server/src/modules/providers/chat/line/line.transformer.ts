import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { LineAdapterConfig, LineApiRequest, LineApiResponse, LineMessageItem } from './types';

export class LineTransformer implements ProviderTransformer<LineAdapterConfig, LineApiRequest, LineApiResponse> {
  transformRequest(options: ProviderSendOptions, _config?: LineAdapterConfig): LineApiRequest {
    const rawTo = options.recipient.to || options.recipient.phone || options.recipient.email;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const mediaUrls = options.content.mediaUrl;

    const messages: LineMessageItem[] = [];

    if (text) {
      messages.push({
        type: 'text',
        text,
      });
    }

    if (mediaUrls && mediaUrls.length > 0) {
      messages.push({
        type: 'image',
        originalContentUrl: mediaUrls[0],
        previewImageUrl: mediaUrls[0],
      });
    }

    if (messages.length === 0) {
      messages.push({
        type: 'text',
        text: 'Notification',
      });
    }

    return {
      to: recipient,
      messages,
    };
  }

  transformResponse(response: LineApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.sentMessages?.[0]?.id;

    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: msgId || `line_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `LINE_ERROR_${statusCode}`,
        message: response.message || response.details?.[0]?.message || 'LINE API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const lineTransformer = new LineTransformer();
