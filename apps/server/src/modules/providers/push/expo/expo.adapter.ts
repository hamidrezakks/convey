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
import { expoTransformer } from './expo.transformer';
import type { ExpoApiRequest, ExpoApiResponse, ExpoPushAdapterConfig } from './types';

export class ExpoPushAdapter implements ProviderAdapter<ExpoPushAdapterConfig, ExpoApiRequest, ExpoApiResponse> {
  readonly id = 'expo';
  readonly name = 'Expo Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ExpoPushAdapterConfig;

  constructor(config?: ExpoPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ExpoPushAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.accessToken);
  }

  transformRequest(options: ProviderSendOptions, config?: ExpoPushAdapterConfig): ExpoApiRequest {
    return expoTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ExpoApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return expoTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ExpoPushAdapterConfig): Promise<ProviderSendResult> {
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
    const accessToken = config.accessToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload[0]?.to || (Array.isArray(reqPayload[0].to) && reqPayload[0].to.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'ExponentPushToken is required for Expo Push',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://exp.host/--/api/v2/push/send';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: ExpoApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ExpoApiResponse;
      } catch {
        responseJson = { errors: [{ code: 'PARSE_ERROR', message: responseText }] };
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
