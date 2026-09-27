import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { pagerdutyTransformer } from './pagerduty.transformer';
import type { PagerdutyApiRequest, PagerdutyApiResponse, PagerdutyToolAdapterConfig } from './types';

export class PagerdutyToolAdapter
  implements ProviderAdapter<PagerdutyToolAdapterConfig, PagerdutyApiRequest, PagerdutyApiResponse>
{
  readonly id = 'pagerduty';
  readonly name = 'PagerDuty Tool';
  readonly channel = Channel.TOOL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: PagerdutyToolAdapterConfig;

  constructor(config?: PagerdutyToolAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PagerdutyToolAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.routingKey);
  }

  transformRequest(options: ProviderSendOptions, config?: PagerdutyToolAdapterConfig): PagerdutyApiRequest {
    return pagerdutyTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PagerdutyApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return pagerdutyTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PagerdutyToolAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider configuration is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.routing_key) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'PagerDuty routingKey is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!reqPayload.payload.summary) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Summary text is required for PagerDuty event',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://events.pagerduty.com/v2/enqueue';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: PagerdutyApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PagerdutyApiResponse;
      } catch {
        responseJson = { message: responseText };
      }

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // This integration has no implemented outbound delivery receipt contract.
    return [];
  }
}
