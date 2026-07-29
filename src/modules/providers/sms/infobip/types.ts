export interface InfobipSmsAdapterConfig {
  baseUrl?: string;
  apiKey?: string;
  from?: string;
}

export interface InfobipSmsDestination {
  to: string;
  messageId?: string;
}

export interface InfobipSmsMessage {
  from?: string;
  destinations: InfobipSmsDestination[];
  text: string;
}

export interface InfobipSmsApiRequest {
  messages: InfobipSmsMessage[];
}

export interface InfobipSmsApiResponse {
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
}

export interface InfobipSmsWebhookPayload {
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
