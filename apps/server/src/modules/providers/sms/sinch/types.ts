export interface SinchAdapterConfig {
  apiKey?: string;
  servicePlanId?: string;
  region?: 'us' | 'eu' | 'au' | 'br' | 'ca';
  apiSecret?: string;
  senderId?: string;
  from?: string;
  baseUrl?: string;
}

export interface SinchApiRequest {
  to: string;
  from?: string;
  text: string;
  mediaUrl?: string[];
  clientRef?: string;
}

export interface SinchApiResponse {
  id?: string;
  messageId?: string;
  status?: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export interface SinchWebhookPayload {
  messageId?: string;
  id?: string;
  status?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
