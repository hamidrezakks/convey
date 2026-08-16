export interface AppioPushAdapterConfig {
  apiKey?: string;
  appId?: string;
}

export interface AppioApiRequest {
  app_id?: string;
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface AppioApiResponse {
  success?: boolean;
  message_id?: string;
  error?: string;
}

export interface AppioWebhookPayload {
  message_id?: string;
  status?: string;
  rawPayload?: unknown;
}
