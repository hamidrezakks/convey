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
import { grafanaOnCallTransformer } from './grafana-on-call.transformer';
import type {
  GrafanaOnCallAdapterConfig,
  GrafanaOnCallApiRequest,
  GrafanaOnCallApiResponse,
  GrafanaOnCallWebhookPayload,
} from './types';

export class GrafanaOnCallChatAdapter
  implements ProviderAdapter<GrafanaOnCallAdapterConfig, GrafanaOnCallApiRequest, GrafanaOnCallApiResponse>
{
  readonly id = 'grafana-on-call';
  readonly name = 'Grafana On-Call';
  readonly channel = Channel.CHAT;

  readonly capabilities: ProviderCapabilities = {
    supportsBulk: false,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: true,
  };

  private config?: GrafanaOnCallAdapterConfig;

  constructor(config?: GrafanaOnCallAdapterConfig) {
    this.config = config;
  }

  hasSetup(configOverride?: GrafanaOnCallAdapterConfig): boolean {
    const config = { ...this.config, ...configOverride };
    return Boolean(config.webhookUrl);
  }

  transformRequest(options: ProviderSendOptions, config?: GrafanaOnCallAdapterConfig): GrafanaOnCallApiRequest {
    return grafanaOnCallTransformer.transformRequest(options, config || this.config);
  }

  transformResponse(response: GrafanaOnCallApiResponse, statusCode?: number, rawBody?: unknown): ProviderSendResult {
    return grafanaOnCallTransformer.transformResponse(response, statusCode, rawBody);
  }

  async send(options: ProviderSendOptions, configOverride?: GrafanaOnCallAdapterConfig): Promise<ProviderSendResult> {
    const config = { ...this.config, ...configOverride };
    const webhookUrl = config.webhookUrl || options.recipient.webhookUrl || options.recipient.to || '';

    const reqPayload = this.transformRequest(options, config);

    if (!webhookUrl) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Grafana On-Call webhookUrl is missing',
          category: ErrorCategory.PERMANENT,
        },
      };
    }

    const endpoint = Array.isArray(webhookUrl) ? webhookUrl[0] : webhookUrl;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(reqPayload),
      });

      const responseText = await response.text();
      let responseJson: GrafanaOnCallApiResponse = {};

      try {
        responseJson = JSON.parse(responseText) as GrafanaOnCallApiResponse;
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
    const webhookData = payload as GrafanaOnCallWebhookPayload;
    const msgId = webhookData.alert_id || webhookData.id;
    if (!msgId) return [];

    return [
      {
        providerId: this.id,
        providerMessageId: msgId,
        normalizedStatus: NormalizedStatus.DELIVERED,
        rawPayload: payload,
        timestamp: new Date(),
      },
    ];
  }
}
