export interface PlivoSmsAdapterConfig {
  authId?: string;
  authToken?: string;
  from?: string;
}

export interface PlivoApiRequest {
  src?: string;
  dst: string;
  text: string;
  type?: 'sms' | 'mms';
  url?: string;
  method?: 'POST' | 'GET';
}

export interface PlivoApiResponse {
  message?: string;
  message_uuid?: string[];
  api_id?: string;
  error?: string;
}

export interface PlivoWebhookPayload {
  MessageUUID?: string;
  Status?: string;
  To?: string;
  From?: string;
  rawPayload?: unknown;
}
