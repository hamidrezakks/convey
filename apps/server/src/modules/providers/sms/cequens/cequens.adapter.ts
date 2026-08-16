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
import { cequensTransformer } from './cequens.transformer';
import type { CequensApiRequest, CequensApiResponse, CequensSmsAdapterConfig, CequensWebhookPayload } from './types';

export class CequensSmsAdapter
  implements ProviderAdapter<CequensSmsAdapterConfig, CequensApiRequest, CequensApiResponse>
{
  readonly id = 'cequens';
  readonly name = 'Cequens SMS';
  readonly channel = Channel.SMS;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: CequensSmsAdapterConfig;

  constructor(config?: CequensSmsAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: CequensSmsAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.apiKey || config.baseUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: CequensSmsAdapterConfig): CequensApiRequest {
    return cequensTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: CequensApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return cequensTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: CequensSmsAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const apiKey = config.apiKey || '';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.recipient) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient phone number is required for Cequens SMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!reqPayload.message) {
      return {
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Message text content is required for Cequens SMS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Cequens API key / Bearer token is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const baseUrl = config.baseUrl || 'https://developer.cequens.com';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/sms/v1/messages`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: CequensApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as CequensApiResponse;
      } catch {
        responseJson = { replyMessage: responseText };
      }

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'HTTP_FETCH_ERROR',
          message: (err as Error).message || 'Failed to connect to Cequens SMS API',
          category: ErrorCategory.TRANSIENT,
        },
      };
    }
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent[] {
    const webhookData = payload as CequensWebhookPayload;
    if (!webhookData?.message_id) return [];

    let normalizedStatus: NormalizedStatus = NormalizedStatus.DELIVERED;
    const rawStatus = (webhookData.status || '').toLowerCase();
    if (rawStatus.includes('fail') || rawStatus.includes('error')) {
      normalizedStatus = NormalizedStatus.FAILED;
    } else if (rawStatus.includes('bounce') || rawStatus.includes('rejected')) {
      normalizedStatus = NormalizedStatus.BOUNCED;
    }

    return [
      {
        providerId: this.id,
        providerMessageId: webhookData.message_id,
        normalizedStatus,
        rawPayload: payload,
        timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
      },
    ];
  }
}
