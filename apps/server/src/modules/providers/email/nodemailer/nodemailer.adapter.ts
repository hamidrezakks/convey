import nodemailer from 'nodemailer';
import type { ProviderAdapter } from '../../core/provider-adapter';
import { normalizeProviderConfig } from '../../core/provider-config';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { nodemailerTransformer } from './nodemailer.transformer';
import type { NodemailerEmailAdapterConfig, NodemailerMailOptions, NodemailerSendResult } from './types';

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
    const config = normalizeProviderConfig(this.id, { ...this.config, ...configOverride });
    return Boolean(config.host) && Boolean(config.user) === Boolean(config.pass);
  }

  transformRequest(options: ProviderSendOptions, config?: NodemailerEmailAdapterConfig): NodemailerMailOptions {
    return nodemailerTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: NodemailerSendResult, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return nodemailerTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: NodemailerEmailAdapterConfig): Promise<ProviderSendResult> {
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

    if (!this.hasSetup(config)) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'SMTP host and a complete optional user/password pair are required',
          category: ErrorCategory.PERMANENT,
        },
      };
    }
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port ?? (config.secure ? 465 : 587),
      secure: config.secure ?? false,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail(reqPayload);

      return this.transformResponse(result, 200, result);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SMTP_SEND_ERROR',
          message: (err as Error).message,
          category:
            (err as { responseCode?: number }).responseCode && (err as { responseCode: number }).responseCode >= 500
              ? ErrorCategory.PERMANENT
              : ErrorCategory.TRANSIENT,
        },
      };
    } finally {
      transport.close();
    }
  }

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // Acceptance/change notifications are not evidence of recipient delivery.
    return [];
  }
}
