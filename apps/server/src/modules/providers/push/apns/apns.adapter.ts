import type { ProviderAdapter } from '../../core/provider-adapter';
import { ProviderTokenCache, signProviderJwt } from '../../core/provider-token';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { http2Request } from '../../core/transport/http2-request';
import { apnsTransformer } from './apns.transformer';
import type { ApnsApiRequest, ApnsApiResponse, ApnsPushAdapterConfig } from './types';

export class ApnsPushAdapter implements ProviderAdapter<ApnsPushAdapterConfig, ApnsApiRequest, ApnsApiResponse> {
  readonly id = 'apns';
  readonly name = 'APNs Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ApnsPushAdapterConfig;

  private tokens = new ProviderTokenCache();

  constructor(
    config?: ApnsPushAdapterConfig,
    private request = http2Request,
  ) {
    this.config = config;
  }

  hasSetup(configOverride?: ApnsPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.bundleId && config.key && config.keyId && config.teamId);
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

    if (!reqPayload.deviceToken || (options.recipient.deviceTokens || options.recipient.fcmTokens || []).length > 1) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Device token is required for APNs',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!this.hasSetup(config)) {
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
    try {
      const token = await this.tokens.get(config, async () => ({
        token: signProviderJwt(
          { alg: 'ES256', kid: config.keyId },
          { iss: config.teamId, iat: Math.floor(Date.now() / 1000) },
          config.key || '',
          'ES256',
        ),
        expiresIn: 3000,
      }));
      const body = JSON.stringify({ ...reqPayload.data, aps: reqPayload.aps });
      if (Buffer.byteLength(body) > 4096)
        return {
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'APNs alert payload exceeds 4096 bytes',
            category: ErrorCategory.PERMANENT,
          },
        };
      const response = await this.request(
        `https://${host}`,
        `/3/device/${encodeURIComponent(reqPayload.deviceToken)}`,
        {
          authorization: `bearer ${token}`,
          'apns-topic': config.bundleId,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        },
        body,
      );
      if (response.status === 403) this.tokens.clear();
      const apnsId = typeof response.headers['apns-id'] === 'string' ? response.headers['apns-id'] : undefined;
      const responseText = response.body;
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

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    return [];
  }
}
