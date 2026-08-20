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
import { plivoTransformer } from './plivo.transformer';
import type { PlivoApiRequest, PlivoApiResponse, PlivoSmsAdapterConfig, PlivoWebhookPayload } from './types';

export class PlivoSmsAdapter implements ProviderAdapter<PlivoSmsAdapterConfig, PlivoApiRequest, PlivoApiResponse> {
  readonly id = 'plivo';
  readonly name = 'Plivo SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: PlivoSmsAdapterConfig;

  constructor(config?: PlivoSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: PlivoSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.authId || config.authToken);
  }

  transformRequest(options: ProviderSendOptions, config?: PlivoSmsAdapterConfig): PlivoApiRequest {
    return plivoTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: PlivoApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return plivoTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: PlivoSmsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const authId = config.authId || '';
    const authToken = config.authToken || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.dst) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Plivo SMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!authId || !authToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Plivo authId or authToken is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://api.plivo.com/v1/Account/${authId}/Message/`;
    const authHeader = `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`;

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
      let responseJson: PlivoApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as PlivoApiResponse;
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
    const webhookData = payload as PlivoWebhookPayload;
    if (!webhookData?.MessageUUID) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.MessageUUID,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
