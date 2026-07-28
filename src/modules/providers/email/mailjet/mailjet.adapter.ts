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
import { mailjetTransformer } from './mailjet.transformer';
import type { MailjetApiRequest, MailjetApiResponse, MailjetEmailAdapterConfig, MailjetWebhookPayload } from './types';

export class MailjetEmailAdapter
  implements ProviderAdapter<MailjetEmailAdapterConfig, MailjetApiRequest, MailjetApiResponse>
{
  readonly id = 'mailjet';
  readonly name = 'Mailjet Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: MailjetEmailAdapterConfig;

  constructor(config?: MailjetEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MailjetEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.apiSecret);
  }

  transformRequest(options: ProviderSendOptions, config?: MailjetEmailAdapterConfig): MailjetApiRequest {
    return mailjetTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MailjetApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mailjetTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MailjetEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const apiSecret = config.apiSecret || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.Messages[0]?.To[0]?.Email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Mailjet',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Mailjet apiKey or apiSecret is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.mailjet.com/v3.1/send';
    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: MailjetApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MailjetApiResponse;
      } catch {
        responseJson = { ErrorMessage: responseText };
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
    const webhookData = payload as MailjetWebhookPayload;
    if (!webhookData?.MessageID) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: String(webhookData.MessageID),
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.time ? new Date(webhookData.time * 1000) : new Date(),
      },
    ];
  }
}
