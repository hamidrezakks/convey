import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { SnsApiRequest, SnsApiResponse, SnsSmsAdapterConfig } from './types';

export class SnsTransformer implements ProviderTransformer<SnsSmsAdapterConfig, SnsApiRequest, SnsApiResponse> {
  transformRequest(options: ProviderSendOptions, config?: SnsSmsAdapterConfig): SnsApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const PhoneNumber = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const Message = (options.content.text || options.content.body || '') as string;
    const senderId = options.from || config?.from;

    const req: SnsApiRequest = {
      PhoneNumber,
      Message,
    };

    if (senderId) {
      req.MessageAttributes = {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: senderId,
        },
      };
    }

    return req;
  }

  transformResponse(response: SnsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.MessageId) {
      return {
        success: true,
        providerMessageId: response.MessageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code || 'SNS_ERROR',
        message: response.message || 'AWS SNS SMS Publish request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const snsTransformer = new SnsTransformer();
