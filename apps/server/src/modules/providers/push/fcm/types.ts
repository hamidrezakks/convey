export interface FcmPushAdapterConfig {
  /** Legacy server keys are no longer supported. */
  secretKey?: string;
  projectId?: string;
  email?: string;
  privateKey?: string;
}
export interface FcmNotificationPayload {
  title?: string;
  body?: string;
}
export interface FcmApiRequest {
  message: { token?: string; notification?: FcmNotificationPayload; data?: Record<string, string> };
}
export interface FcmApiResponse {
  name?: string;
  error?: { code?: number; message?: string; status?: string };
}
export interface FcmWebhookPayload {
  message_id?: string;
  event?: string;
  timestamp?: number;
}
