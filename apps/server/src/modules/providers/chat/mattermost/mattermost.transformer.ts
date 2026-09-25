import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { MattermostAdapterConfig, MattermostApiRequest, MattermostApiResponse } from './types';

export class MattermostTransformer
  implements ProviderTransformer<MattermostAdapterConfig, MattermostApiRequest, MattermostApiResponse>
{
  transformRequest(options: ProviderSendOptions, config?: MattermostAdapterConfig): MattermostApiRequest {
    const rawTo = options.recipient.channel || options.recipient.to || config?.channelId;
    const channelId = Array.isArray(rawTo) ? rawTo[0] : (rawTo as string) || '';

    const text = (options.content.text || options.content.body || options.content.title || '') as string;
    const title = options.content.title;

    return {
      channel_id: channelId,
      message: title ? `**${title}**\n${text}` : text,
    };
  }

  transformResponse(response: MattermostApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300 && response.id) {
      return {
        success: true,
        providerMessageId: response.id,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: `MATTERMOST_ERROR_${statusCode}`,
        message: response.message || response.error || response.detailed_error || 'Mattermost API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const mattermostTransformer = new MattermostTransformer();
