export interface ExpoPushAdapterConfig {
  accessToken?: string;
}

export interface ExpoApiRequestMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export type ExpoApiRequest = ExpoApiRequestMessage[];

export interface ExpoApiResponseData {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ExpoApiResponse {
  data?: ExpoApiResponseData[];
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export interface ExpoWebhookPayload {
  id?: string;
  status?: string;
  rawPayload?: unknown;
}
