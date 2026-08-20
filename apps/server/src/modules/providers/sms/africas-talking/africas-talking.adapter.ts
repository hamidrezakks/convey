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
import { africasTalkingTransformer } from './africas-talking.transformer';
import type {
  AfricasTalkingApiRequest,
  AfricasTalkingApiResponse,
  AfricasTalkingSmsAdapterConfig,
  AfricasTalkingWebhookPayload,
} from './types';

export class AfricasTalkingSmsAdapter
  implements ProviderAdapter<AfricasTalkingSmsAdapterConfig, AfricasTalkingApiRequest, AfricasTalkingApiResponse>
{
  readonly id = 'africas-talking';
  readonly name = 'Africas Talking SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: AfricasTalkingSmsAdapterConfig;

  constructor(config?: AfricasTalkingSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: AfricasTalkingSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.username);
  }

  transformRequest(options: ProviderSendOptions, config?: AfricasTalkingSmsAdapterConfig): AfricasTalkingApiRequest {
    return africasTalkingTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: AfricasTalkingApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return africasTalkingTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(
    options: ProviderSendOptions,
    configOverride?: AfricasTalkingSmsAdapterConfig,
  ): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';
    const username = config.username || 'sandbox';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: "Africa's Talking API key is missing",
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const host = username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    const endpoint = `https://${host}/version1/messaging`;

    const formParams = new URLSearchParams();
    formParams.append('username', username);
    formParams.append('to', reqPayload.to);
    formParams.append('message', reqPayload.message);
    if (reqPayload.from) formParams.append('from', reqPayload.from);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      const responseText = await response.text();
      let responseJson: AfricasTalkingApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as AfricasTalkingApiResponse;
      } catch {
        responseJson = { SMSMessageData: { Message: responseText } };
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
    const webhookData = payload as AfricasTalkingWebhookPayload;
    if (!webhookData?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
