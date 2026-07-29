export interface NodemailerEmailAdapterConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export interface NodemailerMailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface NodemailerSendResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

export interface NodemailerWebhookPayload {
  messageId?: string;
  rawPayload?: unknown;
}
