import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { GrafanaOnCallAdapterConfig, GrafanaOnCallApiRequest, GrafanaOnCallApiResponse } from './types';

export class GrafanaOnCallTransformer
  implements ProviderTransformer<GrafanaOnCallAdapterConfig, GrafanaOnCallApiRequest, GrafanaOnCallApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: GrafanaOnCallAdapterConfig): GrafanaOnCallApiRequest {
    const title = options.content.title || config?.title || 'Grafana On-Call Alert';
    const message = (options.content.text || options.content.body || options.content.html || '') as string;
    const mediaUrls = options.content.mediaUrl;

    return {
      title,
      message,
      image_url: mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : undefined,
      state: config?.state || 'firing',
      alert_id: config?.alertUid || `alert_${Date.now()}`,
    };
  }

  transformResponse(response: GrafanaOnCallApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    const alertId = response.alert_id || response.id;

    if (statusCode >= 200 && statusCode < 300 && (response.status === 'ok' || alertId)) {
      return {
        success: true,
        providerMessageId: alertId,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `GRAFANA_ONCALL_ERROR_${statusCode}`,
        message: response.message || response.error || 'Grafana On-Call API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const grafanaOnCallTransformer = new GrafanaOnCallTransformer();
