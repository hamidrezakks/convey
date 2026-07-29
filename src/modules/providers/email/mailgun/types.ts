export interface MailgunEmailAdapterConfig {
  apiKey?: string;
  domain?: string;
  username?: string;
  baseUrl?: string;
}

export interface MailgunApiRequest {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  'v:variables'?: string;
  cc?: string | string[];
  bcc?: string | string[];
  'h:Reply-To'?: string;
  'o:tag'?: string[];
  'o:tracking'?: boolean;
  [key: string]: unknown;
}

export interface MailgunApiResponse {
  id?: string;
  message?: string;
}

export interface MailgunWebhookPayload {
  'event-data'?: {
    id?: string;
    event?: string;
    recipient?: string;
    timestamp?: number;
    message?: {
      headers?: {
        'message-id'?: string;
      };
    };
  };
  rawPayload?: unknown;
}
