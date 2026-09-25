import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { ProviderAdapter } from '../../core/provider-adapter';
import { httpErrorCategory } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { snsTransformer } from './sns.transformer';
import type { SnsAdapterConfig, SnsApiRequest, SnsApiResponse, SnsWebhookPayload } from './types';

export class SnsSmsAdapter implements ProviderAdapter<SnsAdapterConfig, SnsApiRequest, SnsApiResponse> {
  readonly id = 'sns';
  readonly name = 'Sns';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: true,
  };

  private config?: SnsAdapterConfig;

  constructor(config?: SnsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SnsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.region && config.accessKeyId && config.secretAccessKey);
  }

  transformRequest(options: ProviderSendOptions, config?: SnsAdapterConfig): SnsApiRequest {
    return snsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SnsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return snsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SnsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.PhoneNumber) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Sns',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'AWS region, accessKeyId and secretAccessKey are required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const client = new SNSClient({
      region: config.region,
      maxAttempts: 1,
      credentials: {
        accessKeyId: config.accessKeyId || '',
        secretAccessKey: config.secretAccessKey || '',
        sessionToken: config.sessionToken,
      },
      requestHandler: { connectionTimeout: 15_000, requestTimeout: 30_000 },
    });
    try {
      const result = await client.send(new PublishCommand(reqPayload));
      return this.transformResponse(result, result.$metadata.httpStatusCode ?? 200);
    } catch (err: unknown) {
      const error = err as Error & { $metadata?: { httpStatusCode?: number } };
      return {
        success: false,
        error: {
          code: error.name,
          message: error.message,
          category: httpErrorCategory(error.$metadata?.httpStatusCode ?? 503),
        },
      };
    } finally {
      client.destroy();
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const webhookData = payload as SnsWebhookPayload;
    const msgId = webhookData.MessageId;
    if (!msgId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const status = (webhookData.Status || '').toLowerCase();
    if (status === 'failed' || status === 'undelivered') normalizedStatus = NormalizedStatus.FAILED;
    else if (status !== 'delivered') return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
