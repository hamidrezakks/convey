import type { ProviderAdapter } from '../../core/provider-adapter';
import { httpErrorCategory, providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { outlook365Transformer } from './outlook365.transformer';
import type { Outlook365ApiRequest, Outlook365ApiResponse, Outlook365EmailAdapterConfig } from './types';

export class Outlook365EmailAdapter
  implements ProviderAdapter<Outlook365EmailAdapterConfig, Outlook365ApiRequest, Outlook365ApiResponse>
{
  readonly id = 'outlook365';
  readonly name = 'Outlook 365 Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
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
    return Boolean(config.clientId && config.clientSecret && config.tenantId && config.fromUser);
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
    const fromUser = options.from || config.fromUser || '';

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

    if (!clientId || !clientSecret || !tenantId || !fromUser) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Outlook 365 OAuth credentials (clientId/clientSecret/tenantId) are missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromUser)}/sendMail`;

    try {
      const tokenResponse = await providerFetch(
        `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
          }),
        },
      );
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token) {
        return {
          success: false,
          error: {
            code: 'OAUTH_TOKEN_ERROR',
            message: 'Microsoft Graph token exchange failed',
            category: httpErrorCategory(tokenResponse.status),
          },
        };
      }
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
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

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // Acceptance/change notifications are not evidence of recipient delivery.
    return [];
  }
}
