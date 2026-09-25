import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { GrafanaApiAlertPayload, GrafanaApiResponse, GrafanaToolAdapterConfig } from './types';

export class GrafanaTransformer
  implements ProviderTransformer<GrafanaToolAdapterConfig, GrafanaApiAlertPayload, GrafanaApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: GrafanaToolAdapterConfig): GrafanaApiAlertPayload {
    const summary = (options.content.title ||
      options.content.subject ||
      options.content.body ||
      options.content.text ||
      '') as string;
    const status = (options.content.data?.status as 'firing' | 'resolved') || 'firing';

    return {
      receiver: (options.recipient.to as string) || (options.recipient.channel as string) || 'Convey',
      status,
      title: options.content.title || (options.content.subject as string) || 'Convey Alert',
      message: summary,
      externalURL: config?.alertUrl,
      alerts: [
        {
          status,
          labels: (options.content.data?.labels as Record<string, string>) || { alertname: 'ConveyAlert' },
          annotations: {
            summary,
            description: options.content.body || (options.content.text as string) || summary,
          },
        },
      ],
    };
  }

  transformResponse(response: GrafanaApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: `grafana_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'GRAFANA_ERROR',
        message: response.error || response.message || 'Grafana alert API call failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const grafanaTransformer = new GrafanaTransformer();
