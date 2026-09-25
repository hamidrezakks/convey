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
import { ryverTransformer } from './ryver.transformer';
import type { RyverAdapterConfig, RyverApiRequest, RyverApiResponse } from './types';

export class RyverChatAdapter implements ProviderAdapter<RyverAdapterConfig, RyverApiRequest, RyverApiResponse> {
  readonly id = 'ryver';
  readonly name = 'Ryver';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: RyverAdapterConfig;

  constructor(config?: RyverAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: RyverAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: RyverAdapterConfig): RyverApiRequest {
    return ryverTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: RyverApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return ryverTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: RyverAdapterConfig): Promise<ProviderSendResult> {
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
          message: 'Ryver webhookUrl is missing',
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
      let responseJson: RyverApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as RyverApiResponse;
      } catch {
        responseJson = { id: `ryver_${Date.now()}` };
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
