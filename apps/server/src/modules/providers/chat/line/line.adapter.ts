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
import { lineTransformer } from './line.transformer';
import type { LineAdapterConfig, LineApiRequest, LineApiResponse } from './types';

export class LineChatAdapter implements ProviderAdapter<LineAdapterConfig, LineApiRequest, LineApiResponse> {
  readonly id = 'line';
  readonly name = 'LINE';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: LineAdapterConfig;

  constructor(config?: LineAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: LineAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.channelAccessToken);
  }

  transformRequest(options: ProviderSendOptions, config?: LineAdapterConfig): LineApiRequest {
    return lineTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: LineApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return lineTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: LineAdapterConfig): Promise<ProviderSendResult> {
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
    const channelAccessToken = config.channelAccessToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient is required for LINE',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!channelAccessToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'LINE channel access token is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.line.me/v2/bot/message/push';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: LineApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as LineApiResponse;
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
