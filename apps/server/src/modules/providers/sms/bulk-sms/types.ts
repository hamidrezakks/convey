export interface BulkSmsSmsAdapterConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  from?: string;
}

export interface BulkSmsApiRecipient {
  to: string;
}

export interface BulkSmsApiRequest {
  to: string | string[];
  body: string;
  from?: string;
  routingGroup?: string;
  userSuppliedId?: string;
}

export interface BulkSmsApiResponseItem {
  id?: string;
  type?: string;
  to?: string;
  status?: {
    id?: string;
    type?: string;
    subtype?: string;
    message?: string;
  };
}

export type BulkSmsApiResponse = BulkSmsApiResponseItem[];

export interface BulkSmsWebhookPayload {
  id?: string;
  status?: {
    type?: string;
  };
  timestamp?: string | number;
  rawPayload?: unknown;
}
