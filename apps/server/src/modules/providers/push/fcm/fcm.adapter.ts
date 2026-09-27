import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { httpErrorCategory, providerFetch } from '../../core/provider-http';
import { ProviderTokenCache, signProviderJwt } from '../../core/provider-token';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { fcmTransformer } from './fcm.transformer';
import type { FcmApiRequest, FcmApiResponse, FcmPushAdapterConfig } from './types';

export class FcmPushAdapter implements ProviderAdapter<FcmPushAdapterConfig, FcmApiRequest, FcmApiResponse> {
  readonly id = 'fcm';
  readonly name = 'FCM HTTP v1';
  readonly channel = Channel.PUSH;
  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };
  private tokens = new ProviderTokenCache();
  constructor(private config?: FcmPushAdapterConfig) {}
  hasSetup(override?: FcmPushAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...override });
    return Boolean(config.projectId && config.email && config.privateKey);
  }
  transformRequest(options: ProviderSendOptions, _config?: FcmPushAdapterConfig): FcmApiRequest {
    return fcmTransformer.transformRequest(options);
  }
  transformResponse(response: FcmApiResponse, status?: number, rawBody?: unknown): ProviderSendResult {
    return fcmTransformer.transformResponse(response, status, rawBody);
  }
  async send(options: ProviderSendOptions, override?: FcmPushAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...override });
    const payload = this.transformRequest(options);
    const tokens = options.recipient.fcmTokens || options.recipient.deviceTokens || [];
    if (!payload.message.token || tokens.length > 1)
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'FCM requires exactly one token per send; fan out messages before dispatch',
          category: ErrorCategory.PERMANENT,
        },
      };
    if (!this.hasSetup(config))
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'FCM HTTP v1 requires projectId, email and privateKey from a service account',
          category: ErrorCategory.PERMANENT,
        },
      };
    try {
      const accessToken = await this.tokens.get(config, async () => {
        const now = Math.floor(Date.now() / 1000);
        const assertion = signProviderJwt(
          { alg: 'RS256', typ: 'JWT' },
          {
            iss: config.email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
          },
          config.privateKey || '',
          'RS256',
        );
        const response = await providerFetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        });
        const body = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!response.ok || !body.access_token)
          throw Object.assign(new Error('FCM token exchange failed'), { status: response.status });
        return { token: body.access_token, expiresIn: body.expires_in || 3600 };
      });
      const response = await providerFetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId || '')}/messages:send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 401) this.tokens.clear();
      const text = await response.text();
      let data: FcmApiResponse;
      try {
        data = JSON.parse(text) || {};
      } catch {
        data = { error: { message: 'Invalid FCM response' } };
      }
      return this.transformResponse(data, response.status, text);
    } catch (error) {
      const err = error as Error & { status?: number };
      return {
        success: false,
        error: {
          code: 'FCM_SEND_ERROR',
          message: err.message,
          category: err.status ? httpErrorCategory(err.status) : ErrorCategory.TRANSIENT,
        },
      };
    }
  }
  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    return [];
  }
}
