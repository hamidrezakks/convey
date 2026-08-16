export interface ApnsPushAdapterConfig {
  key?: string;
  keyId?: string;
  teamId?: string;
  bundleId?: string;
  production?: boolean;
}

export interface ApnsPayloadAlert {
  title?: string;
  subtitle?: string;
  body?: string;
}

export interface ApnsPayloadAps {
  alert?: string | ApnsPayloadAlert;
  badge?: number;
  sound?: string;
  'content-available'?: number;
  'mutable-content'?: number;
  category?: string;
  'thread-id'?: string;
}

export interface ApnsApiRequest {
  deviceToken: string;
  aps: ApnsPayloadAps;
  data?: Record<string, unknown>;
}

export interface ApnsApiResponse {
  apnsId?: string;
  status?: number;
  reason?: string;
}

export interface ApnsWebhookPayload {
  apnsId?: string;
  status?: string;
  timestamp?: number;
  rawPayload?: unknown;
}
