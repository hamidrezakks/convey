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
import { nodemailerTransformer } from './nodemailer.transformer';
import type {
  NodemailerEmailAdapterConfig,
  NodemailerMailOptions,
  NodemailerSendResult,
  NodemailerWebhookPayload,
} from './types';

export class NodemailerEmailAdapter
  implements ProviderAdapter<NodemailerEmailAdapterConfig, NodemailerMailOptions, NodemailerSendResult>
{
  readonly id = 'nodemailer';
  readonly name = 'Nodemailer Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: NodemailerEmailAdapterConfig;

  constructor(config?: NodemailerEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: NodemailerEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config && Object.keys(config).length > 0);
  }

  transformRequest(options: ProviderSendOptions, config?: NodemailerEmailAdapterConfig): NodemailerMailOptions {
    return nodemailerTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: NodemailerSendResult, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return nodemailerTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: NodemailerEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.to || (Array.isArray(reqPayload.to) && reqPayload.to.length === 0)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Nodemailer',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    try {
      const generatedMessageId = `nodemailer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const result: NodemailerSendResult = {
        messageId: generatedMessageId,
        accepted: Array.isArray(reqPayload.to) ? reqPayload.to : [reqPayload.to],
      };

      return this.transformResponse(result, 200, result);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'SMTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as NodemailerWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
