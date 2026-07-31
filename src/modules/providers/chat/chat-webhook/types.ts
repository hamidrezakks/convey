export interface ChatWebhookAdapterConfig {
  webhookUrl?: string;
  secretHeader?: string;
  secretKey?: string;
}

export interface ChatWebhookApiRequest {
  channel?: string;
  target?: string;
  text: string;
  data?: Record<string, unknown>;
}

export interface ChatWebhookApiResponse {
  success?: boolean;
  messageId?: string;
  id?: string;
  error?: string;
}

export interface ChatWebhookPayload {
  messageId?: string;
  status?: string;
  rawPayload?: unknown;
}
