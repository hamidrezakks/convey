export interface OneSignalPushAdapterConfig {
  appId?: string;
  apiKey?: string;
}

export interface OneSignalApiRequest {
  app_id: string;
  include_player_ids?: string[];
  include_external_user_ids?: string[];
  headings?: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, unknown>;
}

export interface OneSignalApiResponse {
  id?: string;
  recipients?: number;
  errors?: string[] | Record<string, unknown>;
}

export interface OneSignalWebhookPayload {
  id?: string;
  event?: string;
  rawPayload?: unknown;
}
