export interface NetcoreEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
}

export interface NetcoreApiRecipient {
  email: string;
  name?: string;
}

export interface NetcoreApiPersonalization {
  to: NetcoreApiRecipient[];
  attributes?: Record<string, unknown>;
}

export interface NetcoreApiRequest {
  from: NetcoreApiRecipient;
  subject: string;
  content: Array<{ type: 'html' | 'amp' | 'text'; value: string }>;
  personalizations: NetcoreApiPersonalization[];
  settings?: {
    open_track?: boolean;
    click_track?: boolean;
  };
}

export interface NetcoreApiResponse {
  status?: string;
  message?: string;
  data?: {
    message_id?: string;
  };
}

export interface NetcoreWebhookPayload {
  event?: string;
  email?: string;
  message_id?: string;
  timestamp?: string | number;
  rawPayload?: unknown;
}
