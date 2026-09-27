import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { slackTransformer } from './slack.transformer';
import type { SlackApiRequest, SlackApiResponse, SlackChatAdapterConfig } from './types';

export class SlackChatAdapter implements ProviderAdapter<SlackChatAdapterConfig, SlackApiRequest, SlackApiResponse> {
  readonly id = 'slack';
  readonly name = 'Slack Chat';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: SlackChatAdapterConfig;

  constructor(config?: SlackChatAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SlackChatAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.webhookUrl || config.botToken);
  }

  transformRequest(options: ProviderSendOptions, config?: SlackChatAdapterConfig): SlackApiRequest {
    return slackTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SlackApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return slackTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SlackChatAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider configuration is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const webhookUrl = config.webhookUrl || (options.recipient.webhookUrl as string) || '';
    const botToken = config.botToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl && !botToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Slack webhookUrl or botToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = botToken ? 'https://slack.com/api/chat.postMessage' : webhookUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (botToken) {
      headers.Authorization = `Bearer ${botToken}`;
    }

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      if (!botToken && response.ok && responseText.trim() === 'ok') return { success: true };
      let responseJson: SlackApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as SlackApiResponse;
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
