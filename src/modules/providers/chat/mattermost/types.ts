export interface MattermostAdapterConfig {
  webhookUrl?: string;
  serverUrl?: string;
  personalAccessToken?: string;
  channelId?: string;
}

export interface MattermostApiRequest {
  channel_id?: string;
  message: string;
  root_id?: string;
  file_ids?: string[];
  props?: Record<string, unknown>;
}

export interface MattermostApiResponse {
  id?: string;
  create_at?: number;
  update_at?: number;
  channel_id?: string;
  message?: string;
  error?: string;
  detailed_error?: string;
  status_code?: number;
}

export interface MattermostWebhookPayload {
  id?: string;
  post_id?: string;
  event?: string;
  timestamp?: number;
  rawPayload?: unknown;
}
