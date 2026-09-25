import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { ToolWebhookApiRequest, ToolWebhookApiResponse, ToolWebhookToolAdapterConfig } from './types';

export class ToolWebhookTransformer
  implements ProviderTransformer<ToolWebhookToolAdapterConfig, ToolWebhookApiRequest, ToolWebhookApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: ToolWebhookToolAdapterConfig): ToolWebhookApiRequest {
    return {
      event: 'tool.dispatch',
      timestamp: new Date().toISOString(),
      data: {
        recipient: options.recipient,
        content: options.content,
        metadata: options.metadata,
      },
    };
  }

  transformResponse(response: ToolWebhookApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: response.messageId || `webhook_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: 'TOOL_WEBHOOK_ERROR',
        message: response.error || `Tool Webhook HTTP POST failed with status ${statusCode}`,
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const toolWebhookTransformer = new ToolWebhookTransformer();
