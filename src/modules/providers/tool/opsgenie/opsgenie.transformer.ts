import {
  ErrorCategory,
  type ProviderSendOptions,
  type ProviderSendResult,
  type ProviderTransformer,
} from '../../core/provider-types';
import type { OpsgenieApiCreateAlertPayload, OpsgenieApiResponse, OpsgenieToolAdapterConfig } from './types';

export class OpsgenieTransformer
  implements ProviderTransformer<OpsgenieToolAdapterConfig, OpsgenieApiCreateAlertPayload, OpsgenieApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: OpsgenieToolAdapterConfig): OpsgenieApiCreateAlertPayload {
    const summary = (options.content.title ||
      options.content.subject ||
      options.content.body ||
      options.content.text ||
      '') as string;
    const priority = (options.content.data?.priority as 'P1' | 'P2' | 'P3' | 'P4' | 'P5') || 'P3';

    return {
      message: summary,
      description: options.content.body || (options.content.text as string) || summary,
      priority,
      source: (options.content.data?.source as string) || 'Convey',
      alias: (options.metadata?.alias as string) || undefined,
      details: options.content.data,
    };
  }

  transformResponse(response: OpsgenieApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && (response.requestId || response.result)) {
      return {
        success: true,
        providerMessageId: response.requestId || `opsgenie_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.code || 'OPSGENIE_ERROR',
        message: response.message || 'Opsgenie API request failed',
        category: statusCode >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const opsgenieTransformer = new OpsgenieTransformer();
