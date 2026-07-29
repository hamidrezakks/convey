export interface BandwidthSmsAdapterConfig {
  accountId?: string;
  username?: string;
  password?: string;
  applicationId?: string;
  from?: string;
}

export interface BandwidthApiRequest {
  to: string[];
  from: string;
  text: string;
  applicationId: string;
  media?: string[];
  tag?: string;
}

export interface BandwidthApiResponse {
  id?: string;
  time?: string;
  to?: string[];
  from?: string;
  text?: string;
  applicationId?: string;
  message?: string;
}

export interface BandwidthWebhookPayloadItem {
  type?: string;
  description?: string;
  message?: {
    id?: string;
    to?: string;
    from?: string;
    time?: string | number;
  };
}

export type BandwidthWebhookPayload = BandwidthWebhookPayloadItem[] & {
  message?: {
    id?: string;
    to?: string;
    from?: string;
    time?: string | number;
  };
};
