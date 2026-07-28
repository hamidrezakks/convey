export interface PostmarkEmailAdapterConfig {
  serverToken?: string;
  from?: string;
}

export interface PostmarkApiRequest {
  From: string;
  To: string;
  Subject: string;
  TextBody?: string;
  HtmlBody?: string;
  Tag?: string;
  ReplyTo?: string;
  TrackOpens?: boolean;
  TrackLinks?: 'None' | 'HtmlAndText' | 'HtmlOnly' | 'TextOnly';
  Headers?: Array<{ Name: string; Value: string }>;
  Attachments?: Array<{ Name: string; Content: string; ContentType: string }>;
}

export interface PostmarkApiResponse {
  To?: string;
  SubmittedAt?: string;
  MessageID?: string;
  ErrorCode?: number;
  Message?: string;
}

export interface PostmarkWebhookPayload {
  RecordType?: string;
  MessageID?: string;
  Recipient?: string;
  Tag?: string;
  DeliveredAt?: string;
  rawPayload?: unknown;
}
