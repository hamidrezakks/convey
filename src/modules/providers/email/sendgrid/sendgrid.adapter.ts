import { parseFetchResponse } from '../../../../utils/http';
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
import { sendgridTransformer } from './sendgrid.transformer';
import type {
  SendgridApiRequest,
  SendgridApiResponse,
  SendgridEmailAdapterConfig,
  SendgridWebhookPayload,
} from './types';

export class SendgridEmailAdapter
  implements ProviderAdapter<SendgridEmailAdapterConfig, SendgridApiRequest, SendgridApiResponse>
{
  readonly id = 'sendgrid';
  readonly name = 'Sendgrid Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: SendgridEmailAdapterConfig;

  constructor(config?: SendgridEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SendgridEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey);
  }

  transformRequest(options: ProviderSendOptions, config?: SendgridEmailAdapterConfig): SendgridApiRequest {
    return sendgridTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(
    response: SendgridApiResponse,
    statusCode?: number,
    headers?: Record<string, string>,
  ): ProviderSendResult {
    return sendgridTransformer.transformResponse(response, statusCode, headers);
  }

  async send(options: ProviderSendOptions, configOverride?: SendgridEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.personalizations[0]?.to[0]?.email) {
      return {
        success: false,
        error: { code: 'INVALID_RECIPIENT', message: 'Recipient email is required', category: ErrorCategory.PERMANENT },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'SendGrid API key is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.sendgrid.com/v3/mail/send';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const { statusCode, json, headers } = await parseFetchResponse<SendgridApiResponse>(response);
      return this.transformResponse(json, statusCode, headers);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const events = (Array.isArray(payload) ? payload : [payload]) as SendgridWebhookPayload;
    const results: NormalizedWebhookEvent[] = [];

    for (const item of events) {
      if (!item?.sg_message_id) continue;
      let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
      const eventName = item.event?.toLowerCase() || '';

      if (eventName === 'delivered') normalizedStatus = NormalizedStatus.DELIVERED;
      else if (eventName === 'open') normalizedStatus = NormalizedStatus.OPENED;
      else if (eventName === 'bounce') normalizedStatus = NormalizedStatus.BOUNCED;
      else if (eventName === 'dropped' || eventName === 'deferred') normalizedStatus = NormalizedStatus.FAILED;

      results.push({
        providerId: this.id,
        providerMessageId: item.sg_message_id,
        normalizedStatus,
        rawPayload: item,
        timestamp: item.timestamp ? new Date(item.timestamp * 1000) : new Date(),
      });
    }

    return results;
  }
}
