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
import { msTeamsTransformer } from './msTeams.transformer';
import type { MsTeamsAdapterConfig, MsTeamsApiRequest, MsTeamsApiResponse } from './types';

export class MsTeamsChatAdapter
  implements ProviderAdapter<MsTeamsAdapterConfig, MsTeamsApiRequest, MsTeamsApiResponse>
{
  readonly id = 'msteams';
  readonly name = 'Microsoft Teams';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: MsTeamsAdapterConfig;

  constructor(config?: MsTeamsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MsTeamsAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: MsTeamsAdapterConfig): MsTeamsApiRequest {
    return msTeamsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MsTeamsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return msTeamsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MsTeamsAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookUrl = config.webhookUrl || options.recipient.webhookUrl || options.recipient.to || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Microsoft Teams webhookUrl is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = Array.isArray(webhookUrl) ? webhookUrl[0] : webhookUrl;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MsTeamsApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MsTeamsApiResponse;
      } catch {
        responseJson = {};
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
