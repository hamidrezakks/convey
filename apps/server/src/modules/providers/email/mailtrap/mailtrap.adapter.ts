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
import { mailtrapTransformer } from './mailtrap.transformer';
import type {
  MailtrapApiRequest,
  MailtrapApiResponse,
  MailtrapEmailAdapterConfig,
  MailtrapWebhookPayload,
} from './types';

export class MailtrapEmailAdapter
  implements ProviderAdapter<MailtrapEmailAdapterConfig, MailtrapApiRequest, MailtrapApiResponse>
{
  readonly id = 'mailtrap';
  readonly name = 'Mailtrap Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: MailtrapEmailAdapterConfig;

  constructor(config?: MailtrapEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MailtrapEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiToken || config.inboxId);
  }

  transformRequest(options: ProviderSendOptions, config?: MailtrapEmailAdapterConfig): MailtrapApiRequest {
    return mailtrapTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MailtrapApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mailtrapTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MailtrapEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiToken = config.apiToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || reqPayload.to.length === 0 || !reqPayload.to[0]?.email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Mailtrap',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Mailtrap apiToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = config.inboxId
      ? `https://sandbox.api.mailtrap.io/api/send/${config.inboxId}`
      : 'https://send.api.mailtrap.io/api/send';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Api-Token': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MailtrapApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MailtrapApiResponse;
      } catch {
        responseJson = { errors: [responseText] };
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
    const webhookData = payload as MailtrapWebhookPayload;
    if (!webhookData?.message_id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message_id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(Number(webhookData.timestamp) * 1000) : new Date(),
      },
    ];
  }
}
