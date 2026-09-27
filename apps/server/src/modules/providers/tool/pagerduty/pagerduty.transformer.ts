import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { PagerdutyApiRequest, PagerdutyApiResponse, PagerdutyToolAdapterConfig } from './types';

export class PagerdutyTransformer
  implements ProviderTransformer<PagerdutyToolAdapterConfig, PagerdutyApiRequest, PagerdutyApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: PagerdutyToolAdapterConfig): PagerdutyApiRequest {
    const routingKey =
      (options.recipient.to as string) || (options.recipient.channel as string) || config?.routingKey || '';
    const summary = (options.content.title ||
      options.content.subject ||
      options.content.body ||
      options.content.text ||
      '') as string;
    const severity = (options.content.data?.severity as 'info' | 'warning' | 'error' | 'critical') || 'error';
    const source = (options.content.data?.source as string) || 'Convey';

    return {
      routing_key: routingKey,
      event_action: (options.content.data?.event_action as 'trigger' | 'acknowledge' | 'resolve') || 'trigger',
      payload: {
        summary,
        severity,
        source,
        custom_details: options.content.data,
      },
      dedup_key: (options.metadata?.dedup_key as string) || undefined,
    };
  }

  transformResponse(response: PagerdutyApiResponse, statusCode = 202, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.status === 'success') {
      return {
        success: true,
        providerMessageId: response.dedup_key,
        metadata: {
          rawPayload: rawBody || response,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'PAGERDUTY_ERROR',
        message: response.message || response.errors?.join(', ') || 'PagerDuty Event API call failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: {
        rawPayload: rawBody || response,
      },
    };
  }
}

export const pagerdutyTransformer = new PagerdutyTransformer();
