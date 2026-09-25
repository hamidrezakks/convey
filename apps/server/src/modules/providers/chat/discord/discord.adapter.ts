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
import { discordTransformer } from './discord.transformer';
import type { DiscordApiRequest, DiscordApiResponse, DiscordChatAdapterConfig } from './types';

export class DiscordChatAdapter
  implements ProviderAdapter<DiscordChatAdapterConfig, DiscordApiRequest, DiscordApiResponse>
{
  readonly id = 'discord';
  readonly name = 'Discord Chat';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: DiscordChatAdapterConfig;

  constructor(config?: DiscordChatAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: DiscordChatAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: DiscordChatAdapterConfig): DiscordApiRequest {
    return discordTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: DiscordApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return discordTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: DiscordChatAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || (options.recipient.webhookUrl as string) || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Discord Webhook URL is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    try {
      const response = await providerFetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: DiscordApiResponse = {};

      try {
        if (responseText) {
          responseJson = JSON.parse(responseText) as DiscordApiResponse;
        }
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

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // This integration has no implemented outbound delivery receipt contract.
    return [];
  }
}
