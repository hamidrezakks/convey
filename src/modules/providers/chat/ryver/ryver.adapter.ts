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
import { ryverTransformer } from './ryver.transformer';
import type { RyverAdapterConfig, RyverApiRequest, RyverApiResponse, RyverWebhookPayload } from './types';

export class RyverChatAdapter implements ProviderAdapter<RyverAdapterConfig, RyverApiRequest, RyverApiResponse> {
  readonly id = 'ryver';
  readonly name = 'Ryver';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: RyverAdapterConfig;

  constructor(config?: RyverAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: RyverAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: RyverAdapterConfig): RyverApiRequest {
    return ryverTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: RyverApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return ryverTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: RyverAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || options.recipient.webhookUrl || options.recipient.to || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Ryver webhookUrl is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = Array.isArray(webhookUrl) ? webhookUrl[0] : webhookUrl;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: RyverApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as RyverApiResponse;
      } catch {
        responseJson = { id: `ryver_${Date.now()}` };
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
    const webhookData = payload as RyverWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
