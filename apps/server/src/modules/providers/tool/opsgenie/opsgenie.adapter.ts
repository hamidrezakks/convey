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
import { opsgenieTransformer } from './opsgenie.transformer';
import type { OpsgenieApiCreateAlertPayload, OpsgenieApiResponse, OpsgenieToolAdapterConfig } from './types';

export class OpsgenieToolAdapter
  implements ProviderAdapter<OpsgenieToolAdapterConfig, OpsgenieApiCreateAlertPayload, OpsgenieApiResponse>
{
  readonly id = 'opsgenie';
  readonly name = 'Opsgenie Tool';
  readonly channel = Channel.TOOL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: OpsgenieToolAdapterConfig;

  constructor(config?: OpsgenieToolAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: OpsgenieToolAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.webhookUrl || config.region);
  }

  transformRequest(options: ProviderSendOptions, config?: OpsgenieToolAdapterConfig): OpsgenieApiCreateAlertPayload {
    return opsgenieTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: OpsgenieApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return opsgenieTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: OpsgenieToolAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = (options.recipient.to as string) || (options.recipient.channel as string) || config.apiKey;

    if (!apiKey && !config.webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Opsgenie apiKey or webhookUrl is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const reqPayload = this.transformRequest(options, config);
    const region = config.region?.toLowerCase() === 'eu' ? 'eu' : 'us';
    const endpoint = config.webhookUrl || `https://api.${region === 'eu' ? 'eu.' : ''}opsgenie.com/v2/alerts`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `GenieKey ${apiKey}`;
      }

      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: OpsgenieApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as OpsgenieApiResponse;
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
