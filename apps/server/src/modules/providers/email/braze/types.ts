export interface BrazeEmailAdapterConfig {
  apiKey?: string;
  appGroupKey?: string;
  baseUrl?: string;
}

export interface BrazeApiRequest {
  api_key?: string;
  app_group_id?: string;
  messages: {
    email_message: {
      app_id?: string;
      recipient: { email: string };
      from?: string;
      reply_to?: string;
      subject?: string;
      body?: string;
    };
  };
}

export interface BrazeApiResponse {
  message?: string;
  dispatch_id?: string;
  errors?: string[];
}

export interface BrazeWebhookPayload {
  dispatch_id?: string;
  event_type?: string;
  email?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}

export type BrazeEmailApiRequest = BrazeApiRequest;
export type BrazeEmailApiResponse = BrazeApiResponse;
export type BrazeEmailWebhookPayload = BrazeWebhookPayload;
