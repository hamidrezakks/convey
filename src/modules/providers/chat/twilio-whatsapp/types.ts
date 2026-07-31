export interface TwilioWhatsappAdapterConfig {
  accountSid?: string;
  authToken?: string;
  from?: string;
  sessionOptimization?: {
    enabled?: boolean;
    ttlSeconds?: number;
    fallbackToTemplateIfMissingText?: boolean;
  };
}

export interface TwilioWhatsappApiRequest {
  From: string;
  To: string;
  Body?: string;
  ContentSid?: string;
  ContentVariables?: string;
  MediaUrl?: string[];
}

export interface TwilioWhatsappApiResponse {
  sid?: string;
  status?: string;
  date_created?: string;
  error_code?: number | null;
  error_message?: string | null;
}

export interface TwilioWhatsappWebhookPayload {
  MessageSid?: string;
  SmsSid?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  From?: string;
  To?: string;
  Body?: string;
}
