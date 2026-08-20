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
import { oneSignalTransformer } from './one-signal.transformer';
import type {
  OneSignalApiRequest,
  OneSignalApiResponse,
  OneSignalPushAdapterConfig,
  OneSignalWebhookPayload,
} from './types';

export class OneSignalPushAdapter
  implements ProviderAdapter<OneSignalPushAdapterConfig, OneSignalApiRequest, OneSignalApiResponse>
{
  readonly id = 'one-signal';
  readonly name = 'OneSignal Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: OneSignalPushAdapterConfig;

  constructor(config?: OneSignalPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: OneSignalPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.appId);
  }

  transformRequest(options: ProviderSendOptions, config?: OneSignalPushAdapterConfig): OneSignalApiRequest {
    return oneSignalTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: OneSignalApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return oneSignalTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: OneSignalPushAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const appId = config.appId || '';

    const reqPayload = this.transformRequest(options, config);
    reqPayload.app_id = appId;

    if (!reqPayload.include_player_ids?.length && !reqPayload.include_external_user_ids?.length) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Player ID / Subscriber ID is required for OneSignal',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey || !appId) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'OneSignal apiKey or appId is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://onesignal.com/api/v1/notifications';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: OneSignalApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as OneSignalApiResponse;
      } catch {
        responseJson = { errors: [responseText] };
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
    const webhookData = payload as OneSignalWebhookPayload;
    if (!webhookData?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
