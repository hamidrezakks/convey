export interface ClicksendSmsAdapterConfig {
  username?: string;
  apiKey?: string;
  from?: string;
}

export interface ClicksendApiMessage {
  to: string;
  body: string;
  from?: string;
  source?: string;
  custom_string?: string;
}

export interface ClicksendApiRequest {
  messages: ClicksendApiMessage[];
}

export interface ClicksendApiResponse {
  http_code?: number;
  response_code?: string;
  response_msg?: string;
  data?: {
    messages?: Array<{
      message_id?: string;
      to?: string;
      status?: string;
      error_text?: string;
    }>;
  };
}

export interface ClicksendWebhookPayload {
  message_id?: string;
  status?: string;
  to?: string;
  rawPayload?: unknown;
}
