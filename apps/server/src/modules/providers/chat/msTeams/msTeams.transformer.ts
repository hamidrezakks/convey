import { httpErrorCategory } from '../../core/provider-http';
import type { ProviderSendOptions, ProviderSendResult, ProviderTransformer } from '../../core/provider-types';
import type { MsTeamsAdapterConfig, MsTeamsApiRequest, MsTeamsApiResponse } from './types';

export class MsTeamsTransformer
  implements ProviderTransformer<MsTeamsAdapterConfig, MsTeamsApiRequest, MsTeamsApiResponse>
{
  transformRequest(options: ProviderSendOptions, _config?: MsTeamsAdapterConfig): MsTeamsApiRequest {
    const title = options.content.title || 'Message';
    const text = (options.content.text || options.content.body || options.content.html || '') as string;
    const mediaUrls = options.content.mediaUrl;

    return {
      type: 'MessageCard',
      summary: title,
      themeColor: '0076D7',
      title,
      text,
      body: {
        contentType: 'html',
        content: text,
      },
      sections:
        mediaUrls && mediaUrls.length > 0
          ? [
              {
                activityTitle: title,
                activityImage: mediaUrls[0],
                text,
              },
            ]
          : undefined,
    };
  }

  transformResponse(response: MsTeamsApiResponse, statusCode = 200, rawBody?: unknown): ProviderSendResult {
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        providerMessageId: response.id || `msteams_${Date.now()}`,
        metadata: { rawPayload: rawBody || response },
      };
    }

    return {
      success: false,
      error: {
        code: response.error?.code || `MSTEAMS_ERROR_${statusCode}`,
        message: response.error?.message || 'Microsoft Teams API request failed',
        category: httpErrorCategory(statusCode),
      },
      metadata: { rawPayload: rawBody || response },
    };
  }
}

export const msTeamsTransformer = new MsTeamsTransformer();
