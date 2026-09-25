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
import { pusherBeamsTransformer } from './pusher-beams.transformer';
import type { PusherBeamsApiRequest, PusherBeamsApiResponse, PusherBeamsPushAdapterConfig } from './types';

export class PusherBeamsPushAdapter
  implements ProviderAdapter<PusherBeamsPushAdapterConfig, PusherBeamsApiRequest, PusherBeamsApiResponse>
{
  readonly id = 'pusher-beams';
  readonly name = 'Pusher Beams Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: PusherBeamsPushAdapterConfig;

  constructor(config?: PusherBeamsPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PusherBeamsPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.instanceId || config.secretKey);
  }

  transformRequest(options: ProviderSendOptions, config?: PusherBeamsPushAdapterConfig): PusherBeamsApiRequest {
    return pusherBeamsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PusherBeamsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return pusherBeamsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PusherBeamsPushAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const instanceId = config.instanceId || '';
    const secretKey = config.secretKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.users?.length && !reqPayload.interests?.length) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Interest or user recipient is required for Pusher Beams',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!instanceId || !secretKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Pusher Beams instanceId or secretKey is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const publishType = reqPayload.users ? 'publishes/users' : 'publishes/interests';
    const endpoint = `https://${instanceId}.pushnotifications.pusher.com/customer_api/v1/instances/${instanceId}/${publishType}`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: PusherBeamsApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PusherBeamsApiResponse;
      } catch {
        responseJson = { error: responseText };
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
