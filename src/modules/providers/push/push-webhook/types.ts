export interface PushWebhookAdapterConfig {
  webhookUrl?: string;
  secretHeader?: string;
  secretKey?: string;
}

export interface PushWebhookApiRequest {
  target: string | string[];
  title: string;
  body: string;
  sound?: string;
  badge?: number;
  data?: Record<string, unknown>;
}

export interface PushWebhookApiResponse {
  success?: boolean;
  messageId?: string;
  id?: string;
  error?: string;
}

export interface PushWebhookPayload {
  messageId?: string;
  status?: string;
  rawPayload?: unknown;
}
