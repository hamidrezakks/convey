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
import { apnsTransformer } from './apns.transformer';
import type { ApnsApiRequest, ApnsApiResponse, ApnsPushAdapterConfig, ApnsWebhookPayload } from './types';

export class ApnsPushAdapter implements ProviderAdapter<ApnsPushAdapterConfig, ApnsApiRequest, ApnsApiResponse> {
  readonly id = 'apns';
  readonly name = 'APNs Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: ApnsPushAdapterConfig;

  constructor(config?: ApnsPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ApnsPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.bundleId || config.key || config.production);
  }

  transformRequest(options: ProviderSendOptions, config?: ApnsPushAdapterConfig): ApnsApiRequest {
    return apnsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ApnsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return apnsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ApnsPushAdapterConfig): Promise<ProviderSendResult> {
    const config: ApnsPushAdapterConfig = {
      key: configOverride?.key || this.config?.key || '',
      keyId: configOverride?.keyId || this.config?.keyId || '',
      teamId: configOverride?.teamId || this.config?.teamId || '',
      bundleId: configOverride?.bundleId || this.config?.bundleId || '',
      production: configOverride?.production ?? this.config?.production ?? false,
    };
    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.deviceToken) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Device token is required for APNs',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!config.bundleId || !config.key) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'APNs bundleId or key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const host = config.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const endpoint = `https://${host}/3/device/${reqPayload.deviceToken}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apns-topic': config.bundleId,
          'apns-push-type': 'alert',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aps: reqPayload.aps,
          ...reqPayload.data,
        }),
      });

      const apnsId = response.headers.get('apns-id') || undefined;
      const responseText = await response.text();
      const responseJson: ApnsApiResponse = { apnsId, status: response.status };

      try {
        if (responseText) {
          const parsed = JSON.parse(responseText) as { reason?: string };
          responseJson.reason = parsed.reason;
        }
      } catch {
        responseJson.reason = responseText;
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
    const webhookData = payload as ApnsWebhookPayload;
    if (!webhookData?.apnsId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.apnsId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp * 1000) : new Date(),
      },
    ];
  }
}
