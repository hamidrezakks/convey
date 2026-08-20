import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { TwilioApiRequest, TwilioApiResponse, TwilioSmsAdapterConfig } from './types';

export class TwilioTransformer
  implements ProviderTransformer<TwilioSmsAdapterConfig, TwilioApiRequest, TwilioApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: TwilioSmsAdapterConfig): TwilioApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const from = options.from || config?.from;
    const body = (options.content.text || options.content.body || '') as string;
    const mediaUrl = options.content.mediaUrl;

    return {
      To: to,
      From: from || '',
      Body: body,
      MediaUrl: mediaUrl,
    };
  }

  transformResponse(response: TwilioApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    const isSuccess = statusCode >= 200 && statusCode < 300 && Boolean(response.sid);

    if (isSuccess && response.sid) {
      return {
        success: true,
        providerMessageId: response.sid,
        metadata: {
          status: response.status || 'queued',
          rawPayload: rawBody || response,
        },
      };
    }

    return {
      success: false,
      error: {
        code: response.code || response.error_code ? String(response.code || response.error_code) : 'TWILIO_ERROR',
        message: response.message || response.error_message || 'Twilio SMS API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: {
        rawPayload: rawBody || response,
      },
    };
  }
}

export const twilioTransformer = new TwilioTransformer();
