export interface EmailjsEmailAdapterConfig {
  serviceId?: string;
  templateId?: string;
  publicKey?: string;
  privateKey?: string;
}

export interface EmailjsApiRequest {
  service_id: string;
  template_id: string;
  user_id: string;
  accessToken?: string;
  template_params: {
    to_email?: string;
    from_name?: string;
    subject?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface EmailjsApiResponse {
  status?: number;
  text?: string;
  error?: string;
}

export interface EmailjsWebhookPayload {
  status?: string;
  message_id?: string;
  messageId?: string;
  rawPayload?: unknown;
}
