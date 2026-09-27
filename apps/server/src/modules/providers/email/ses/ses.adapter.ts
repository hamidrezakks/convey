import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
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
import { sesTransformer } from './ses.transformer';
import type { SesApiRequest, SesApiResponse, SesEmailAdapterConfig, SesWebhookPayload } from './types';

export class SesEmailAdapter implements ProviderAdapter<SesEmailAdapterConfig, SesApiRequest, SesApiResponse> {
  readonly id = 'ses';
  readonly name = 'AWS SES Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: SesEmailAdapterConfig;

  constructor(config?: SesEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SesEmailAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.region && config.accessKeyId && config.secretAccessKey);
  }

  transformRequest(options: ProviderSendOptions, config?: SesEmailAdapterConfig): SesApiRequest {
    return sesTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SesApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sesTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SesEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Complete provider configuration is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.Destination.ToAddresses[0]) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for AWS SES',
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
    const client = new SESv2Client({
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
      const result = await client.send(new SendEmailCommand(reqPayload));
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
    const webhookData = payload as SesWebhookPayload;
    if (!webhookData?.mail?.messageId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const type = webhookData.notificationType?.toLowerCase() || '';
    if (type === 'delivery') normalizedStatus = NormalizedStatus.DELIVERED;
    else if (type === 'bounce') normalizedStatus = NormalizedStatus.BOUNCED;
    else if (type === 'reject') normalizedStatus = NormalizedStatus.FAILED;
    else return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.mail.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.mail.timestamp ? new Date(webhookData.mail.timestamp) : new Date(),
      },
    ];
  }
}
