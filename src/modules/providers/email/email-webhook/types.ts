export interface EmailWebhookAdapterConfig {
  webhookUrl?: string;
  secretHeader?: string;
  secretKey?: string;
}

export interface EmailWebhookApiRequest {
  to: string | string[];
  from?: string;
  senderName?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

export interface EmailWebhookApiResponse {
  success?: boolean;
  messageId?: string;
  id?: string;
  error?: string;
}

export interface EmailWebhookPayload {
  messageId?: string;
  event?: string;
  rawPayload?: unknown;
}
