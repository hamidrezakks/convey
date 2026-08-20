export interface BrevoEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
}

export interface BrevoApiRecipient {
  email: string;
  name?: string;
}

export interface BrevoApiRequest {
  sender?: BrevoApiRecipient;
  to: BrevoApiRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  replyTo?: BrevoApiRecipient;
  params?: Record<string, unknown>;
  tags?: string[];
}

export interface BrevoApiResponse {
  messageId?: string;
  messageIds?: string[];
  code?: string;
  message?: string;
}

export interface BrevoWebhookPayload {
  event?: string;
  email?: string;
  'message-id'?: string;
  date?: string;
  rawPayload?: unknown;
}
