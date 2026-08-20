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
import { bandwidthTransformer } from './bandwidth.transformer';
import type {
  BandwidthApiRequest,
  BandwidthApiResponse,
  BandwidthSmsAdapterConfig,
  BandwidthWebhookPayload,
} from './types';

export class BandwidthSmsAdapter
  implements ProviderAdapter<BandwidthSmsAdapterConfig, BandwidthApiRequest, BandwidthApiResponse>
{
  readonly id = 'bandwidth';
  readonly name = 'Bandwidth SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: BandwidthSmsAdapterConfig;

  constructor(config?: BandwidthSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: BandwidthSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.accountId || config.username || config.password || config.applicationId);
  }

  transformRequest(options: ProviderSendOptions, config?: BandwidthSmsAdapterConfig): BandwidthApiRequest {
    return bandwidthTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: BandwidthApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return bandwidthTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: BandwidthSmsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const accountId = config.accountId || '';
    const username = config.username || '';
    const password = config.password || '';
    const applicationId = config.applicationId || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || reqPayload.to.length === 0 || !reqPayload.to[0]) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Bandwidth',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!accountId || !username || !password || !applicationId) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Bandwidth credentials (accountId/username/password/applicationId) are missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://messaging.bandwidth.com/api/v2/users/${accountId}/messages`;
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

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
      let responseJson: BandwidthApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as BandwidthApiResponse;
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
    const webhookData = payload as BandwidthWebhookPayload;
    if (!webhookData?.message?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: webhookData.message.time ? new Date(webhookData.message.time) : new Date(),
      },
    ];
  }
}
