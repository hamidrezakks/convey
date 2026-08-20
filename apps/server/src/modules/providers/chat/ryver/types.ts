export interface RyverAdapterConfig {
  organization?: string;
  apiKey?: string;
  webhookUrl?: string;
}

export interface RyverApiRequest {
  body: string;
  createDate?: string;
}

export interface RyverApiResponse {
  d?: {
    id?: string | number;
    body?: string;
    createDate?: string;
  };
  id?: string | number;
  message?: string;
  error?: {
    message?: string;
  };
}

export interface RyverWebhookPayload {
  messageId?: string;
  eventType?: string;
  workroomId?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
