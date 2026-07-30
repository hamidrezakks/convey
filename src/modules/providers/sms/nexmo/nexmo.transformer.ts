import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { NexmoApiRequest, NexmoApiResponse, NexmoSmsAdapterConfig } from './types';

export class NexmoTransformer implements ProviderTransformer<NexmoSmsAdapterConfig, NexmoApiRequest, NexmoApiResponse> {
  transformRequest(options: ProviderSendOptions, config?: NexmoSmsAdapterConfig): NexmoApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from || 'Vonage';

    return {
      api_key: config?.apiKey || '',
      api_secret: config?.apiSecret || '',
      to,
      from,
      text,
    };
  }

  transformResponse(response: NexmoApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msg = response.messages?.[0];

    if (statusCode >= 200 && statusCode < 300 && msg?.status === '0' && msg['message-id']) {
      return {
        success: true,
        providerMessageId: msg['message-id'],
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: msg?.status ? `STATUS_${msg.status}` : 'NEXMO_ERROR',
        message: msg?.['error-text'] || 'Vonage (Nexmo) SMS request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const nexmoTransformer = new NexmoTransformer();
