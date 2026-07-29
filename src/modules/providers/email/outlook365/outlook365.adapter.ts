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
import { outlook365Transformer } from './outlook365.transformer';
import type {
  Outlook365ApiRequest,
  Outlook365ApiResponse,
  Outlook365EmailAdapterConfig,
  Outlook365WebhookPayload,
} from './types';

export class Outlook365EmailAdapter
  implements ProviderAdapter<Outlook365EmailAdapterConfig, Outlook365ApiRequest, Outlook365ApiResponse>
{
  readonly id = 'outlook365';
  readonly name = 'Outlook 365 Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private config?: Outlook365EmailAdapterConfig;

  constructor(config?: Outlook365EmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: Outlook365EmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.clientId || config.clientSecret || config.tenantId || config.fromUser);
  }

  transformRequest(options: ProviderSendOptions, config?: Outlook365EmailAdapterConfig): Outlook365ApiRequest {
    return outlook365Transformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: Outlook365ApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return outlook365Transformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: Outlook365EmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const clientId = config.clientId || '';
    const clientSecret = config.clientSecret || '';
    const tenantId = config.tenantId || '';
    const fromUser = options.from || config.fromUser || 'me';

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.message.toRecipients[0]?.emailAddress?.address) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for Outlook 365',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!clientId || !clientSecret || !tenantId) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Outlook 365 OAuth credentials (clientId/clientSecret/tenantId) are missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://graph.microsoft.com/v1.0/users/${fromUser}/sendMail`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_oauth_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: Outlook365ApiResponse = {};

      try {
        if (responseText) {
          responseJson = JSON.parse(responseText) as Outlook365ApiResponse;
        }
      } catch {
        responseJson = { error: { code: 'UNKNOWN_ERROR', message: responseText } };
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
    const webhookData = payload as Outlook365WebhookPayload;
    const firstRes = webhookData?.value?.[0];
    if (!firstRes?.resourceData?.id) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: firstRes.resourceData.id,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
