export interface AnypostEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
  baseUrl?: string;
}

export interface AnypostApiRecipient {
  email: string;
  name?: string;
}

export interface AnypostApiAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface AnypostApiRequest {
  to: string | string[] | AnypostApiRecipient[];
  from: string | AnypostApiRecipient;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  attachments?: AnypostApiAttachment[];
}

export interface AnypostApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  error?: string;
}

export interface AnypostWebhookPayload {
  eventId?: string;
  status?: string;
  messageId?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
