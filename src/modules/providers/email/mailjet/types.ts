export interface MailjetEmailAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  from?: string;
  senderName?: string;
}

export interface MailjetApiRecipient {
  Email: string;
  Name?: string;
  MessageID?: number;
}

export interface MailjetApiMessage {
  From: MailjetApiRecipient;
  To: MailjetApiRecipient[];
  Subject: string;
  TextPart?: string;
  HTMLPart?: string;
  Cc?: MailjetApiRecipient[];
  Bcc?: MailjetApiRecipient[];
  TemplateID?: number;
  TemplateLanguage?: boolean;
  Variables?: Record<string, unknown>;
  Attachments?: Array<{ ContentType: string; Filename: string; Base64Content: string }>;
}

export interface MailjetApiRequest {
  Messages: MailjetApiMessage[];
}

export interface MailjetApiResponse {
  Messages?: Array<{
    Status: string;
    To: MailjetApiRecipient[];
    ToStatus?: Array<{ MessageID: number; Status: string }>;
    Errors?: Array<{ ErrorMessage: string; ErrorCode?: string | number }>;
  }>;
  ErrorMessage?: string;
}

export interface MailjetWebhookPayload {
  event?: string;
  email?: string;
  MessageID?: number;
  time?: number;
  rawPayload?: unknown;
}
