import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { RyverAdapterConfig, RyverApiRequest, RyverApiResponse } from './types';

export class RyverTransformer implements ProviderTransformer<RyverAdapterConfig, RyverApiRequest, RyverApiResponse> {
  transformRequest(options: ProviderSendOptions, _config?: RyverAdapterConfig): RyverApiRequest {
    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    return {
      body: text,
      createDate: new Date().toISOString(),
    };
  }

  transformResponse(response: RyverApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const msgId = response.d?.id || response.id;

    if (statusCode >= 200 && statusCode < 300 && msgId !== undefined) {
      return {
        success: true,
        providerMessageId: String(msgId),
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `RYVER_ERROR_${statusCode}`,
        message: response.message || response.error?.message || 'Ryver API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const ryverTransformer = new RyverTransformer();
