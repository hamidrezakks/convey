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
import { mailgunTransformer } from './mailgun.transformer';
import type { MailgunApiRequest, MailgunApiResponse, MailgunEmailAdapterConfig, MailgunWebhookPayload } from './types';

export class MailgunEmailAdapter
  implements ProviderAdapter<MailgunEmailAdapterConfig, MailgunApiRequest, MailgunApiResponse>
{
  readonly id = 'mailgun';
  readonly name = 'Mailgun Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: MailgunEmailAdapterConfig;

  constructor(config?: MailgunEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: MailgunEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.domain || config.username || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: MailgunEmailAdapterConfig): MailgunApiRequest {
    return mailgunTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: MailgunApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return mailgunTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: MailgunEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const domain = config.domain || '';
    const username = config.username || 'api';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Mailgun',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey || !domain) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Mailgun apiKey or domain is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const baseUrl = config.baseUrl || 'https://api.mailgun.net';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v3/${domain}/messages`;

    const formParams = new URLSearchParams();
    formParams.append('from', reqPayload.from);
    formParams.append('to', Array.isArray(reqPayload.to) ? reqPayload.to.join(',') : reqPayload.to);
    formParams.append('subject', reqPayload.subject);
    if (reqPayload.text) formParams.append('text', reqPayload.text);
    if (reqPayload.html) formParams.append('html', reqPayload.html);
    if (reqPayload['h:Reply-To']) formParams.append('h:Reply-To', reqPayload['h:Reply-To']);
    if (reqPayload.template) formParams.append('template', reqPayload.template);
    if (reqPayload['v:variables']) formParams.append('v:variables', reqPayload['v:variables']);

    const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      const responseText = await response.text();
      let responseJson: MailgunApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as MailgunApiResponse;
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
    const webhookData = payload as MailgunWebhookPayload;
    const eventData = webhookData?.['event-data'];
    const msgId = eventData?.id || eventData?.message?.headers?.['message-id'];
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const event = eventData.event?.toLowerCase() || '';

    if (event === 'delivered') normalizedStatus = NormalizedStatus.DELIVERED;
    else if (event === 'opened') normalizedStatus = NormalizedStatus.OPENED;
    else if (event === 'bounced') normalizedStatus = NormalizedStatus.BOUNCED;
    else if (event === 'failed') normalizedStatus = NormalizedStatus.FAILED;

    return [
      {
        providerId: this.id,
        providerMessageId: msgId.replace(/[<>]/g, ''),
        normalizedStatus,
        rawPayload: payload,
        timestamp: eventData.timestamp ? new Date(eventData.timestamp * 1000) : new Date(),
      },
    ];
  }
}
