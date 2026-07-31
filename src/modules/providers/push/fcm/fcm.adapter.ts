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
import { fcmTransformer } from './fcm.transformer';
import type { FcmApiRequest, FcmApiResponse, FcmPushAdapterConfig, FcmWebhookPayload } from './types';

export class FcmPushAdapter implements ProviderAdapter<FcmPushAdapterConfig, FcmApiRequest, FcmApiResponse> {
  readonly id = 'fcm';
  readonly name = 'Fcm Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: FcmPushAdapterConfig;

  constructor(config?: FcmPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: FcmPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.secretKey);
  }

  transformRequest(options: ProviderSendOptions, config?: FcmPushAdapterConfig): FcmApiRequest {
    return fcmTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: FcmApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return fcmTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: FcmPushAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.secretKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to && (!reqPayload.registration_ids || reqPayload.registration_ids.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'FCM recipient token (to/fcmTokens) is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'FCM server key is missing', category: ErrorCategory.PERMANENT },
      };
    }

    const endpoint = 'https://fcm.googleapis.com/fcm/send';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `key=${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: FcmApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as FcmApiResponse;
      } catch {
        responseJson = { error: { message: responseText } };
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
    const webhookData = payload as FcmWebhookPayload;
    if (!webhookData?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message_id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
