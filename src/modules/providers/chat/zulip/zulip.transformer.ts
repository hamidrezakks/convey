import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { ZulipAdapterConfig, ZulipApiRequest, ZulipApiResponse } from './types';

export class ZulipTransformer implements ProviderTransformer<ZulipAdapterConfig, ZulipApiRequest, ZulipApiResponse> {
  transformRequest(options: ProviderSendOptions, config?: ZulipAdapterConfig): ZulipApiRequest {
    const rawTo = options.recipient.email || options.recipient.phone || options.recipient.to;
    const recipient = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const stream = (options.recipient.channel || options.recipient.stream) as string | undefined;
    const topic = (options.content.topic || options.content.title || config?.topic || 'General') as string;

    const content = (options.content.text || options.content.body || options.content.html || '') as string;

    if (stream) {
      return {
        type: 'stream',
        to: stream,
        topic,
        content,
      };
    }

    return {
      type: 'private',
      to: recipient,
      content,
    };
  }

  transformResponse(response: ZulipApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.result === 'success' && response.id !== undefined) {
      return {
        success: true,
        providerMessageId: String(response.id),
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code ? `ERR_${response.code}` : `ZULIP_ERROR_${statusCode}`,
        message: response.msg || 'Zulip API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const zulipTransformer = new ZulipTransformer();
