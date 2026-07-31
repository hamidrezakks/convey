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
import { getstreamTransformer } from './getstream.transformer';
import type {
  GetstreamAdapterConfig,
  GetstreamApiRequest,
  GetstreamApiResponse,
  GetstreamWebhookPayload,
} from './types';

export class GetstreamChatAdapter
  implements ProviderAdapter<GetstreamAdapterConfig, GetstreamApiRequest, GetstreamApiResponse>
{
  readonly id = 'getstream';
  readonly name = 'Getstream';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: GetstreamAdapterConfig;

  constructor(config?: GetstreamAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: GetstreamAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.channelType || config.channelId);
  }

  transformRequest(options: ProviderSendOptions, config?: GetstreamAdapterConfig): GetstreamApiRequest {
    return getstreamTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: GetstreamApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return getstreamTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: GetstreamAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const channelType = config.channelType || 'messaging';
    const rawChannel = options.recipient.channel || options.recipient.to || config.channelId;
    const channelId = Array.isArray(rawChannel) ? rawChannel[0] : (rawChannel as string) || '';

    const reqPayload = this.transformRequest(options, config);

    if (!channelId) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient channelId is required for Getstream',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Getstream API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://chat.stream-io-api.com/channels/${channelType}/${channelId}/message?api_key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Stream-Auth-Type': 'jwt',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: GetstreamApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as GetstreamApiResponse;
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
    const webhookData = payload as GetstreamWebhookPayload;
    if (!webhookData?.message?.id) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const evtType = (webhookData.type || '').toLowerCase();
    if (evtType.includes('read')) normalizedStatus = NormalizedStatus.READ;

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message.id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.created_at ? new Date(webhookData.created_at) : new Date(),
      },
    ];
  }
}
