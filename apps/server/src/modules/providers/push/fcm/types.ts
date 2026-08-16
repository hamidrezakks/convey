export interface FcmPushAdapterConfig {
  secretKey?: string;
  projectId?: string;
  email?: string;
}

export interface FcmNotificationPayload {
  title?: string;
  body?: string;
}

export interface FcmApiRequest {
  to?: string;
  registration_ids?: string[];
  notification?: FcmNotificationPayload;
  data?: Record<string, unknown>;
}

export interface FcmApiResponse {
  multicast_id?: number;
  success?: number;
  failure?: number;
  canonical_ids?: number;
  results?: Array<{
    message_id?: string;
    error?: string;
  }>;
  message_id?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface FcmWebhookPayload {
  message_id?: string;
  event?: string;
  timestamp?: number;
  rawPayload?: unknown;
}
