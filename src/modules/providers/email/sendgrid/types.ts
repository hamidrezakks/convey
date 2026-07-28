export interface SendgridEmailAdapterConfig {
  apiKey?: string;
  from?: string;
  senderName?: string;
  ipPoolName?: string;
  region?: string;
}

export interface SendgridApiRecipient {
  email: string;
  name?: string;
}

export interface SendgridApiPersonalization {
  to: SendgridApiRecipient[];
  cc?: SendgridApiRecipient[];
  bcc?: SendgridApiRecipient[];
  dynamic_template_data?: Record<string, unknown>;
}

export interface SendgridApiContent {
  type: string;
  value: string;
}

export interface SendgridApiRequest {
  personalizations: SendgridApiPersonalization[];
  from: SendgridApiRecipient;
  reply_to?: SendgridApiRecipient;
  subject: string;
  content: SendgridApiContent[];
  template_id?: string;
  ip_pool_name?: string;
}

export interface SendgridApiResponse {
  statusCode?: number;
  message?: string;
  errors?: Array<{ message: string }>;
}

export interface SendgridWebhookPayloadItem {
  email?: string;
  timestamp?: number;
  event?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  response?: string;
  reason?: string;
  status?: string;
}

export type SendgridWebhookPayload = SendgridWebhookPayloadItem[];
