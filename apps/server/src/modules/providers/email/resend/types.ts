export interface ResendEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
}

export interface ResendApiRequest {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  tags?: Array<{ name: string; value: string }>;
  attachments?: Array<{ content?: string | Buffer; filename?: string; path?: string }>;
}

export interface ResendApiResponse {
  id?: string;
  name?: string;
  message?: string;
  statusCode?: number;
}

export interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
    created_at?: string | number;
  };
  rawPayload?: unknown;
}
