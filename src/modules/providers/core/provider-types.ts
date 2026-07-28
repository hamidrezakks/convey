import { Channel } from '../../messaging/messaging.types';

export { Channel };

export enum ProviderState {
  UNCONFIGURED = 'UNCONFIGURED',
  CONFIGURED = 'CONFIGURED',
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  DISABLED = 'DISABLED',
}

export interface ProviderConfigMeta {
  providerId: string;
  generation: number;
  updatedAt: Date;
  checksum: string;
}

export enum NormalizedStatus {
  DELIVERED = 'delivered',
  OPENED = 'opened',
  READ = 'read',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

export enum ErrorCategory {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  RATE_LIMITED = 'rate_limited',
  POLICY_BLOCKED = 'policy_blocked',
  UNKNOWN = 'unknown',
}

export interface ProviderCapabilities {
  supportsBulk: boolean;
  maxBulkSize?: number;
  supportsDeliveryReceipts: boolean;
  supportsReadReceipts: boolean;
  supportsAttachments: boolean;
  supportsTemplates: boolean;
  supportsMedia: boolean;
  rateLimitPerSecond?: number;
  rateLimitQps?: number;
}

export interface UnifiedRecipient {
  to?: string | string[];
  email?: string | string[];
  phone?: string | string[];
  fcmTokens?: string[];
  deviceTokens?: string[];
  subscriberId?: string;
  chatId?: string;
  channel?: string;
  webhookUrl?: string;
  [key: string]: unknown;
}

export interface UnifiedContent {
  subject?: string;
  body?: string;
  text?: string;
  html?: string;
  title?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
  mediaUrl?: string[];
  badge?: number;
  sound?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProviderSendOptions {
  recipient: UnifiedRecipient;
  content: UnifiedContent;
  from?: string;
  senderName?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  customHeaders?: Record<string, string>;
  [key: string]: unknown;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: {
    code: string;
    category: ErrorCategory;
    message: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ProviderTransformer<TConfig = Record<string, unknown>, TReq = unknown, TRes = unknown> {
  transformRequest(options: ProviderSendOptions, config?: TConfig): TReq;
  transformResponse(response: TRes, statusCode?: number, rawBody?: unknown): ProviderSendResult;
}

export interface NormalizedWebhookEvent {
  providerId: string;
  providerMessageId: string;
  normalizedStatus: NormalizedStatus;
  errorCode?: string;
  errorMessage?: string;
  rawPayload: unknown;
  timestamp: Date;
}

export interface ProviderWebhookPayload {
  rawBody: unknown;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
}
