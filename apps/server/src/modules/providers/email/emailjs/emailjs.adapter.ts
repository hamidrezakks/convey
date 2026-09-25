import type { ProviderAdapter } from '../../core/provider-adapter';
import { providerFetch } from '../../core/provider-http';
import {
  Channel,
  ErrorCategory,
  type NormalizedWebhookEvent,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';
import { emailjsTransformer } from './emailjs.transformer';
import type { EmailjsApiRequest, EmailjsApiResponse, EmailjsEmailAdapterConfig } from './types';

export class EmailjsEmailAdapter
  implements ProviderAdapter<EmailjsEmailAdapterConfig, EmailjsApiRequest, EmailjsApiResponse>
{
  readonly id = 'emailjs';
  readonly name = 'EmailJS Email';
  readonly channel = Channel.EMAIL;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: false,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsMedia: false,
  };

  private config?: EmailjsEmailAdapterConfig;

  constructor(config?: EmailjsEmailAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: EmailjsEmailAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.serviceId && config.templateId && config.publicKey);
  }

  transformRequest(options: ProviderSendOptions, config?: EmailjsEmailAdapterConfig): EmailjsApiRequest {
    return emailjsTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: EmailjsApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return emailjsTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: EmailjsEmailAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };

    const reqPayload = this.transformRequest(options, config);

    if (!reqPayload.template_params.to_email) {
      return {
        success: false,
        error: {
          code: 'INVALID_RECIPIENT',
          message: 'Recipient email is required for EmailJS',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    if (!reqPayload.service_id || !reqPayload.user_id) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'EmailJS serviceId or publicKey (userId) is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';

    try {
      const response = await providerFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      const responseJson: EmailjsApiResponse = { status: response.status, text: responseText };

      return this.transformResponse(responseJson, response.status, responseText);
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'HTTP_FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }

  parseWebhook(_payload: unknown): NormalizedWebhookEvent[] {
    // This integration has no implemented outbound delivery receipt contract.
    return [];
  }
}
