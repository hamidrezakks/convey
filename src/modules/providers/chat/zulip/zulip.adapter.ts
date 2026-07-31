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
import type { ZulipAdapterConfig, ZulipApiRequest, ZulipApiResponse, ZulipWebhookPayload } from './types';
import { zulipTransformer } from './zulip.transformer';

export class ZulipChatAdapter implements ProviderAdapter<ZulipAdapterConfig, ZulipApiRequest, ZulipApiResponse> {
  readonly id = 'zulip';
  readonly name = 'Zulip';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ZulipAdapterConfig;

  constructor(config?: ZulipAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ZulipAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.domain || config.email || config.username || config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: ZulipAdapterConfig): ZulipApiRequest {
    return zulipTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ZulipApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return zulipTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ZulipAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const domain = config.domain || '';
    const email = config.email || config.username || '';
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient is required for Zulip',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!email || !apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Zulip email or API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const host = domain.startsWith('http') ? domain : `https://${domain || 'zulipchat.com'}`;
    const endpoint = `${host.replace(/\/$/, '')}/api/v1/messages`;
    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64');

    const params = new URLSearchParams();
    params.append('type', reqPayload.type);
    params.append('to', reqPayload.to);
    params.append('content', reqPayload.content);
    if (reqPayload.topic) {
      params.append('topic', reqPayload.topic);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      const responseText = await response.text();
      let responseJson: ZulipApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ZulipApiResponse;
      } catch {
        responseJson = { msg: responseText };
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
    const webhookData = payload as ZulipWebhookPayload;
    const msgId = webhookData.message?.id;
    if (msgId === undefined) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: String(msgId),
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.message?.timestamp ? new Date(webhookData.message.timestamp * 1000) : new Date(),
      },
    ];
  }
}
