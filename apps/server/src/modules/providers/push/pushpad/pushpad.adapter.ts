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
import { pushpadTransformer } from './pushpad.transformer';
import type { PushpadApiRequest, PushpadApiResponse, PushpadPushAdapterConfig, PushpadWebhookPayload } from './types';

export class PushpadPushAdapter
  implements ProviderAdapter<PushpadPushAdapterConfig, PushpadApiRequest, PushpadApiResponse>
{
  readonly id = 'pushpad';
  readonly name = 'Pushpad Push';
  readonly channel = Channel.PUSH;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: PushpadPushAdapterConfig;

  constructor(config?: PushpadPushAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PushpadPushAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.authToken || config.projectId);
  }

  transformRequest(options: ProviderSendOptions, config?: PushpadPushAdapterConfig): PushpadApiRequest {
    return pushpadTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PushpadApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return pushpadTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PushpadPushAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const authToken = config.authToken || '';
    const projectId = config.projectId || '';

    const reqPayload = this.transformRequest(options, config);

    if (!authToken || !projectId) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Pushpad authToken or projectId is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://pushpad.xyz/api/v1/projects/${projectId}/notifications`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Token token="${authToken}"`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          notification: reqPayload,
        }),
      });

      const responseText = await response.text();
      let responseJson: PushpadApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PushpadApiResponse;
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

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as PushpadWebhookPayload;
    if (webhookData?.id == null) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: String(webhookData.id),
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
