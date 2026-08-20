export interface AzureSmsSmsAdapterConfig {
  connectionString?: string;
  from?: string;
}

export interface AzureSmsApiRequest {
  from: string;
  to: string[];
  message: string;
  smsSendOptions?: {
    enableDeliveryReport?: boolean;
    tag?: string;
  };
  sendSmsOptions?: {
    enableDeliveryReport?: boolean;
    tag?: string;
  };
}

export interface AzureSmsApiResponseItem {
  to?: string;
  messageId?: string;
  httpStatusCode?: number;
  successful?: boolean;
  errorMessage?: string;
}

export type AzureSmsApiResponse =
  | AzureSmsApiResponseItem[]
  | {
      messageId?: string;
      successful?: boolean;
      errorMessage?: string;
    };

export interface AzureSmsWebhookPayload {
  to?: string;
  from?: string;
  messageId?: string;
  deliveryStatus?: string;
  rawPayload?: unknown;
}
