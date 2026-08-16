export interface WebexMessagingAdapterConfig {
  bearerToken?: string;
  apiKey?: string;
  roomId?: string;
}

export interface WebexMessagingApiRequest {
  roomId?: string;
  toPersonId?: string;
  toPersonEmail?: string;
  text: string;
  markdown?: string;
  files?: string[];
}

export interface WebexMessagingApiResponse {
  id?: string;
  roomId?: string;
  roomType?: string;
  text?: string;
  personId?: string;
  personEmail?: string;
  created?: string;
  message?: string;
  errors?: Array<{ description?: string }>;
}

export interface WebexMessagingWebhookPayload {
  id?: string;
  name?: string;
  resource?: string;
  event?: string;
  data?: {
    id?: string;
    roomId?: string;
    personId?: string;
    personEmail?: string;
  };
  rawPayload?: unknown;
}
