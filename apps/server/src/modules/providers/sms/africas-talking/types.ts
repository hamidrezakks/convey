export interface AfricasTalkingSmsAdapterConfig {
  username?: string;
  apiKey?: string;
  from?: string;
}

export interface AfricasTalkingApiRequest {
  username: string;
  to: string;
  message: string;
  from?: string;
}

export interface AfricasTalkingApiResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: Array<{
      statusCode?: number;
      number?: string;
      status?: string;
      cost?: string;
      messageId?: string;
    }>;
  };
}

export interface AfricasTalkingWebhookPayload {
  id?: string;
  status?: string;
  phoneNumber?: string;
  rawPayload?: unknown;
}
