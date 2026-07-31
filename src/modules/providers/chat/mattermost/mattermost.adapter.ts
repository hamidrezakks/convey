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
import { mattermostTransformer } from './mattermost.transformer';
import type {
  MattermostAdapterConfig,
  MattermostApiRequest,
  MattermostApiResponse,
  MattermostWebhookPayload,
} from './types';

export class MattermostChatAdapter
  implements ProviderAdapter<MattermostAdapterConfig, MattermostApiRequest, MattermostApiResponse>
{
  readonly id = 'mattermost';
  readonly name = 'Mattermost';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: MattermostAdapterConfig;

  constructor(config?: MattermostAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MattermostAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl || config.serverUrl || config.personalAccessToken);
  }

  transformRequest(options: ProviderSendOptions, config?: MattermostAdapterConfig): MattermostApiRequest {
    return mattermostTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MattermostApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mattermostTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MattermostAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || options.recipient.webhookUrl;
    const serverUrl = config.serverUrl || '';
    const token = config.personalAccessToken || '';

    const reqPayload = this.transformRequest(options, config);

    // Support Webhook or REST API endpoint
    const endpoint = webhookUrl || `${serverUrl.replace(/\/$/, '')}/api/v4/posts`;

    if (!webhookUrl && (!serverUrl || !token)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Mattermost webhookUrl or serverUrl and token are missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token && !webhookUrl) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MattermostApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MattermostApiResponse;
      } catch {
        responseJson = { id: `mattermost_${Date.now()}` };
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
    const webhookData = payload as MattermostWebhookPayload;
    const msgId = webhookData.post_id || webhookData.id;
    if (!msgId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
