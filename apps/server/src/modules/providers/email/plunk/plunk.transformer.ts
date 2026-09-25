import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PlunkApiRequest, PlunkApiResponse, PlunkEmailAdapterConfig } from './types';

export class PlunkTransformer
  implements ProviderTransformer<PlunkEmailAdapterConfig, PlunkApiRequest, PlunkApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: PlunkEmailAdapterConfig): PlunkApiRequest {
    const rawTo = options.recipient.email || options.recipient.to;
    const to = Array.isArray(rawTo) ? rawTo : (rawTo as string) || '';

    return {
      to,
      subject: (options.content.subject as string) || 'No Subject',
      body: (options.content.html || options.content.body || options.content.text || '') as string,
      name: options.senderName,
    };
  }

  transformResponse(response: PlunkApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.success !== false) {
      return {
        success: true,
        providerMessageId: response.id || `plunk_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'PLUNK_ERROR',
        message: response.error || 'Plunk Email API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const plunkTransformer = new PlunkTransformer();
