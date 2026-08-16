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
import { infobipEmailTransformer } from './infobip.transformer';
import type {
  InfobipEmailAdapterConfig,
  InfobipEmailApiRequest,
  InfobipEmailApiResponse,
  InfobipEmailWebhookPayload,
} from './types';

export class InfobipEmailAdapter
  implements ProviderAdapter<InfobipEmailAdapterConfig, InfobipEmailApiRequest, InfobipEmailApiResponse>
{
  readonly id = 'infobip';
  readonly name = 'Infobip Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: InfobipEmailAdapterConfig;

  constructor(config?: InfobipEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: InfobipEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: InfobipEmailAdapterConfig): InfobipEmailApiRequest {
    return infobipEmailTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: InfobipEmailApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return infobipEmailTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: InfobipEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const baseUrl = config.baseUrl || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Infobip Email',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey || !baseUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Infobip apiKey or baseUrl is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/email/1/send`;

    const formData = new FormData();
    formData.append('from', reqPayload.from);
    formData.append('to', reqPayload.to);
    formData.append('subject', reqPayload.subject);
    if (reqPayload.text) formData.append('text', reqPayload.text);
    if (reqPayload.html) formData.append('html', reqPayload.html);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      let responseJson: InfobipEmailApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as InfobipEmailApiResponse;
      } catch {
        responseJson = { requestError: { serviceException: { messageId: 'ERROR', text: responseText } } };
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
    const webhookData = payload as InfobipEmailWebhookPayload;
    if (!webhookData?.results?.[0]?.messageId) return [];

    const firstRes = webhookData.results[0];
    return [
      {
        providerId: this.id,
        providerMessageId: firstRes.messageId || 'infobip_email',
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
