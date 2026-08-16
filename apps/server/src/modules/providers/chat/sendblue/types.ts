export interface SendblueAdapterConfig {
  apiKey?: string;
  apiSecret?: string;
  secretKey?: string;
  from?: string;
}

export interface SendblueApiRequest {
  number: string;
  content: string;
  media_url?: string;
  send_style?: string;
  status_callback?: string;
}

export interface SendblueApiResponse {
  status?: string;
  handle?: string;
  message_handle?: string;
  date_sent?: string;
  error_message?: string;
  code?: number;
}

export interface SendblueWebhookPayload {
  event_type?: string;
  handle?: string;
  number?: string;
  status?: string;
  date_sent?: string;
  rawPayload?: unknown;
}
