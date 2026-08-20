export interface InfobipEmailAdapterConfig {
  baseUrl?: string;
  apiKey?: string;
  from?: string;
}

export interface InfobipEmailApiRequest {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface InfobipEmailApiResponse {
  messages?: Array<{
    to?: string;
    messageId?: string;
    status?: {
      groupId?: number;
      groupName?: string;
      id?: number;
      name?: string;
      description?: string;
    };
  }>;
  requestError?: {
    serviceException?: {
      messageId?: string;
      text?: string;
    };
  };
}

export interface InfobipEmailWebhookPayload {
  results?: Array<{
    messageId?: string;
    to?: string;
    status?: {
      groupId?: number;
      groupName?: string;
      name?: string;
    };
  }>;
  rawPayload?: unknown;
}
