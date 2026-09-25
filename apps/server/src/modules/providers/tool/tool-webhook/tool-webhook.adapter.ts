import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  NormalizedStatus,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { receiptStatus } from '../../core/receipt-status';
import { toolWebhookTransformer } from './tool-webhook.transformer';
import type {
  ToolWebhookApiRequest,
  ToolWebhookApiResponse,
  ToolWebhookPayload,
  ToolWebhookToolAdapterConfig,
} from './types';

export class ToolWebhookToolAdapter
  implements ProviderAdapter<ToolWebhookToolAdapterConfig, ToolWebhookApiRequest, ToolWebhookApiResponse>
{
  readonly id = 'tool-webhook';
  readonly name = 'Tool Webhook';
  readonly channel = Channel.TOOL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: ToolWebhookToolAdapterConfig;

  constructor(config?: ToolWebhookToolAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: ToolWebhookToolAdapterConfig): boolean {
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: ToolWebhookToolAdapterConfig): ToolWebhookApiRequest {
    return toolWebhookTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: ToolWebhookApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return toolWebhookTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: ToolWebhookToolAdapterConfig): Promise<ProviderSendResult> {
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
    const webhookUrl = (options.recipient.to as string) || (options.recipient.channel as string) || config.webhookUrl;

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_WEBHOOK_URL',
          message: 'Tool webhookUrl is required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const reqPayload = this.transformRequest(options, config);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      const response = await providerFetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: ToolWebhookApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as ToolWebhookApiResponse;
      } catch {
        responseJson = { messageId: `wh_${Date.now()}` };
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
    if (!payload || typeof payload !== 'object') return [];
    const normalizedStatus = receiptStatus(payload, 'status', {
      delivered: NormalizedStatus.DELIVERED,
      failed: NormalizedStatus.FAILED,
      undelivered: NormalizedStatus.FAILED,
      bounced: NormalizedStatus.BOUNCED,
      opened: NormalizedStatus.OPENED,
      read: NormalizedStatus.READ,
    });
    if (!normalizedStatus) return [];

    const webhookData = payload as ToolWebhookPayload;
    if (!webhookData?.messageId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.messageId,
        normalizedStatus,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
