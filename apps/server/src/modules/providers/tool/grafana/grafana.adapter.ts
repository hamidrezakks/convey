import type { ProviderAdapter } from '../../core/provider-adapter';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { grafanaTransformer } from './grafana.transformer';
import type { GrafanaApiAlertPayload, GrafanaApiResponse, GrafanaToolAdapterConfig } from './types';

export class GrafanaToolAdapter
  implements ProviderAdapter<GrafanaToolAdapterConfig, GrafanaApiAlertPayload, GrafanaApiResponse>
{
  readonly id = 'grafana';
  readonly name = 'Grafana Tool';
  readonly channel = Channel.TOOL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: GrafanaToolAdapterConfig;

  constructor(config?: GrafanaToolAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: GrafanaToolAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl || config.apiToken);
  }

  transformRequest(options: ProviderSendOptions, config?: GrafanaToolAdapterConfig): GrafanaApiAlertPayload {
    return grafanaTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: GrafanaApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return grafanaTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: GrafanaToolAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = (options.recipient.to as string) || (options.recipient.channel as string) || config.webhookUrl;

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_WEBHOOK_URL',
          message: 'Grafana webhookUrl is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const reqPayload = this.transformRequest(options, config);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiToken) {
        headers.Authorization = `Bearer ${config.apiToken}`;
      }

      const response = await providerFetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: GrafanaApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as GrafanaApiResponse;
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
