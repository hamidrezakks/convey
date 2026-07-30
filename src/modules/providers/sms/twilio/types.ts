export interface TwilioSmsAdapterConfig {
  accountSid?: string;
  authToken?: string;
  from?: string;
  region?: string;
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export type TwilioAdapterConfig = TwilioSmsAdapterConfig;

export interface TwilioSmsApiRequest {
  From: string;
  To: string;
  Body: string;
  StatusCallback?: string;
  MediaUrl?: string[];
}

export interface TwilioSmsApiResponse {
  sid?: string;
  status?: string;
  date_created?: string;
  code?: number | null;
  message?: string | null;
  error_code?: number | null;
  error_message?: string | null;
}

export interface TwilioSmsWebhookPayload {
  MessageSid?: string;
  SmsSid?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  From?: string;
  To?: string;
}

export type TwilioApiRequest = TwilioSmsApiRequest;
export type TwilioApiResponse = TwilioSmsApiResponse;
export type TwilioWebhookPayload = TwilioSmsWebhookPayload;
