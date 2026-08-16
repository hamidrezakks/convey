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
import type {
  WebexMessagingAdapterConfig,
  WebexMessagingApiRequest,
  WebexMessagingApiResponse,
  WebexMessagingWebhookPayload,
} from './types';
import { webexMessagingTransformer } from './webex-messaging.transformer';

export class WebexMessagingChatAdapter
  implements ProviderAdapter<WebexMessagingAdapterConfig, WebexMessagingApiRequest, WebexMessagingApiResponse>
{
  readonly id = 'webex-messaging';
  readonly name = 'Webex Messaging';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: WebexMessagingAdapterConfig;

  constructor(config?: WebexMessagingAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: WebexMessagingAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.bearerToken || config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: WebexMessagingAdapterConfig): WebexMessagingApiRequest {
    return webexMessagingTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: WebexMessagingApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return webexMessagingTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: WebexMessagingAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const bearerToken = config.bearerToken || config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.roomId && !reqPayload.toPersonEmail && !reqPayload.toPersonId) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient roomId, personEmail, or personId is required for Webex Messaging',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!bearerToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Webex bearer token is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://webexapis.com/v1/messages';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: WebexMessagingApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as WebexMessagingApiResponse;
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

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as WebexMessagingWebhookPayload;
    const msgId = webhookData.data?.id || webhookData.id;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const event = (webhookData.event || webhookData.name || '').toLowerCase();
    if (event.includes('read') || event.includes('seen')) normalizedStatus = NormalizedStatus.READ;
    else if (event.includes('failed') || event.includes('error')) normalizedStatus = NormalizedStatus.FAILED;

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
