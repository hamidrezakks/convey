export interface MailtrapEmailAdapterConfig {
  apiToken?: string;
  inboxId?: string;
  from?: string;
  senderName?: string;
}

export interface MailtrapApiRecipient {
  email: string;
  name?: string;
}

export interface MailtrapApiRequest {
  from: MailtrapApiRecipient;
  to: MailtrapApiRecipient[];
  subject: string;
  text?: string;
  html?: string;
  template_uuid?: string;
  template_variables?: Record<string, unknown>;
  category?: string;
}

export interface MailtrapApiResponse {
  success?: boolean;
  message_ids?: string[];
  errors?: string[];
}

export interface MailtrapWebhookPayload {
  event?: string;
  email?: string;
  message_id?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
