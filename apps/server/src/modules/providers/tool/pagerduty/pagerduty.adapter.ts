import type { ProviderAdapter } from '../../core/provider-adapter';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { pagerdutyTransformer } from './pagerduty.transformer';
import type {
  PagerdutyApiRequest,
  PagerdutyApiResponse,
  PagerdutyToolAdapterConfig,
  PagerdutyWebhookPayload,
} from './types';

export class PagerdutyToolAdapter
  implements ProviderAdapter<PagerdutyToolAdapterConfig, PagerdutyApiRequest, PagerdutyApiResponse>
{
  readonly id = 'pagerduty';
  readonly name = 'PagerDuty Tool';
  readonly channel = Channel.TOOL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
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
    const config = { ...this.config, ...configOverride };
    return Boolean(config && Object.keys(config).length > 0);
  }

  transformRequest(options: ProviderSendOptions, config?: PagerdutyToolAdapterConfig): PagerdutyApiRequest {
    return pagerdutyTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PagerdutyApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return pagerdutyTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PagerdutyToolAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
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
      const response = await fetch(endpoint, {
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

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as PagerdutyWebhookPayload;
    if (!webhookData?.event?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.event.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.event.occurred_at ? new Date(webhookData.event.occurred_at) : new Date(),
      },
    ];
  }
}
