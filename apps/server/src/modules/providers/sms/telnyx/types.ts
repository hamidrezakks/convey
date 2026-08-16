export interface TelnyxSmsAdapterConfig {
  apiKey?: string;
  from?: string;
  messagingProfileId?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export type TelnyxAdapterConfig = TelnyxSmsAdapterConfig;

export interface TelnyxApiRequest {
  from?: string;
  messaging_profile_id?: string;
  to: string;
  text: string;
  media_urls?: string[];
  webhook_url?: string;
}

export interface TelnyxApiResponse {
  data?: {
    id?: string;
    record_type?: string;
    to?: Array<{ phone_number?: string; status?: string }>;
    from?: { phone_number?: string };
    text?: string;
  };
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
}

export interface TelnyxWebhookPayload {
  data?: {
    event_type?: string;
    id?: string;
    payload?: {
      id?: string;
      to?: Array<{ phone_number?: string; status?: string }>;
    };
  };
  rawPayload?: unknown;
}
