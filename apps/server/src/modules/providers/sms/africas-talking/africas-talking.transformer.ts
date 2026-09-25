import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { AfricasTalkingApiRequest, AfricasTalkingApiResponse, AfricasTalkingSmsAdapterConfig } from './types';

export class AfricasTalkingTransformer
  implements ProviderTransformer<AfricasTalkingSmsAdapterConfig, AfricasTalkingApiRequest, AfricasTalkingApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: AfricasTalkingSmsAdapterConfig): AfricasTalkingApiRequest {
    const rawTo = options.recipient.phone || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo.join(',') : (rawTo as string) || '';

    const message = (options.content.text || options.content.body || '') as string;
    const from = options.from || config?.from;

    return {
      username: config?.username || 'sandbox',
      to,
      message,
      from,
    };
  }

  transformResponse(response: AfricasTalkingApiResponse, statusCode = 201, rawBody?: unknown): ProviderSendResult {
    const recipient = response.SMSMessageData?.Recipients?.[0];

    if (statusCode >= 200 && statusCode < 300 && recipient?.messageId) {
      return {
        success: true,
        providerMessageId: recipient.messageId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: recipient?.status || 'AFRICAS_TALKING_ERROR',
        message: response.SMSMessageData?.Message || "Africa's Talking SMS request failed",
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const africasTalkingTransformer = new AfricasTalkingTransformer();
