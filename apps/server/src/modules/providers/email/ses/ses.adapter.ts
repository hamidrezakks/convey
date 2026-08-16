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
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: SesEmailAdapterConfig;

  constructor(config?: SesEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: SesEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.region || config.accessKeyId);
  }

  transformRequest(options: ProviderSendOptions, config?: SesEmailAdapterConfig): SesApiRequest {
    return sesTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: SesApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return sesTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: SesEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const region = config.region || 'us-east-1';

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

    const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: SesApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as SesApiResponse;
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
    const webhookData = payload as SesWebhookPayload;
    if (!webhookData?.mail?.messageId) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const type = webhookData.notificationType?.toLowerCase() || '';
    if (type === 'delivery') normalizedStatus = NormalizedStatus.DELIVERED;
    else if (type === 'bounce') normalizedStatus = NormalizedStatus.BOUNCED;
    else if (type === 'reject') normalizedStatus = NormalizedStatus.FAILED;

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
