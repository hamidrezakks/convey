export interface ToolWebhookToolAdapterConfig {
  webhookUrl?: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface ToolWebhookApiRequest {
  event: string;
  timestamp: string;
  data: {
    recipient: Record<string, unknown>;
    content: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

export interface ToolWebhookApiResponse {
  success?: boolean;
  messageId?: string;
  error?: string;
}

export interface ToolWebhookPayload {
  messageId?: string;
  event?: string;
  timestamp?: string;
}
