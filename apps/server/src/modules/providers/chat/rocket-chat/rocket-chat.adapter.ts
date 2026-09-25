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
import { rocketChatTransformer } from './rocket-chat.transformer';
import type { RocketChatAdapterConfig, RocketChatApiRequest, RocketChatApiResponse } from './types';

export class RocketChatChatAdapter
  implements ProviderAdapter<RocketChatAdapterConfig, RocketChatApiRequest, RocketChatApiResponse>
{
  readonly id = 'rocket-chat';
  readonly name = 'Rocket.Chat';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: RocketChatAdapterConfig;

  constructor(config?: RocketChatAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: RocketChatAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.token || config.user || config.userId || config.serverUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: RocketChatAdapterConfig): RocketChatApiRequest {
    return rocketChatTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: RocketChatApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return rocketChatTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: RocketChatAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const token = config.token || '';
    const user = config.user || config.userId || '';
    const serverUrl = config.serverUrl || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.roomId && !reqPayload.channel) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient channel or roomId is required for Rocket.Chat',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!token || !user) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Rocket.Chat token or user ID is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const host = serverUrl.startsWith('http') ? serverUrl : `https://${serverUrl || 'rocket.chat'}`;
    const endpoint = `${host.replace(/\/$/, '')}/api/v1/chat.postMessage`;

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Auth-Token': token,
          'X-User-Id': user,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: RocketChatApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as RocketChatApiResponse;
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
