export interface MailersendEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
}

export interface MailersendApiRecipient {
  email: string;
  name?: string;
}

export interface MailersendApiRequest {
  from: MailersendApiRecipient;
  to: MailersendApiRecipient[];
  subject: string;
  text?: string;
  html?: string;
  template_id?: string;
  reply_to?: MailersendApiRecipient;
  variables?: Array<{
    email: string;
    substitutions: Array<{ var: string; value: string }>;
  }>;
  attachments?: Array<{
    content: string;
    filename: string;
    id?: string;
  }>;
}

export interface MailersendApiResponse {
  message_id?: string;
  id?: string;
  message?: string;
  warnings?: string[];
}

export interface MailersendWebhookPayload {
  type?: string;
  data?: {
    id?: string;
    created_at?: string | number;
    email?: {
      id?: string;
      recipient?: {
        email?: string;
      };
    };
  };
  rawPayload?: unknown;
}
