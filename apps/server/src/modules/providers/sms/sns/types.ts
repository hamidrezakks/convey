export interface SnsSmsAdapterConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  from?: string;
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}
export type SnsAdapterConfig = SnsSmsAdapterConfig;

export interface SnsApiRequest {
  PhoneNumber: string;
  Message: string;
  MessageAttributes?: Record<
    string,
    {
      DataType: string;
      StringValue: string;
    }
  >;
}

export interface SnsApiResponse {
  MessageId?: string;
  message?: string;
  code?: string;
}

export interface SnsWebhookPayload {
  MessageId?: string;
  Status?: string;
  rawPayload?: unknown;
}
