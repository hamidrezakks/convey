import { z } from 'zod';

export enum MessageState {
  ACCEPTED = 'accepted',
  SCHEDULED = 'scheduled',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  OPENED = 'opened',
  READ = 'read',
  BOUNCED = 'bounced',
}

export enum MessagePriority {
  CRITICAL = 'critical',
  TRANSACTIONAL = 'transactional',
  NORMAL = 'normal',
  MARKETING = 'marketing',
}

export enum OutboxState {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

export enum OutboxType {
  MESSAGE_DISPATCH = 'message.dispatch',
}

export enum MetricType {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  OPENED = 'opened',
  READ = 'read',
}

export enum BatchStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

export enum IdempotencyState {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
}

export enum AttemptOrigin {
  INITIAL = 'initial',
  RETRY = 'retry',
  PROVIDER_FAILOVER = 'provider_failover',
  FALLBACK = 'fallback',
}

export enum Channel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  CHAT = 'chat',
  TOOL = 'tool',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  FCM = 'fcm',
  APNS = 'apns',
}

export enum ReservationStatus {
  ACQUIRED = 'acquired',
  COMPLETED = 'completed',
}

export enum AttemptState {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  OPENED = 'opened',
  READ = 'read',
  BOUNCED = 'bounced',
}

export enum CampaignState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export enum ErrorCategory {
  PERMANENT = 'permanent',
  TRANSIENT = 'transient',
  UNKNOWN = 'unknown',
  RATE_LIMITED = 'rate_limited',
  POLICY_BLOCKED = 'policy_blocked',
}

export enum QueueName {
  MESSAGE_DISPATCH = 'message-dispatch',
  MESSAGE_DISPATCH_HIGH = 'message-dispatch-high',
  MESSAGE_DISPATCH_NORMAL = 'message-dispatch-normal',
  MESSAGE_DISPATCH_BULK = 'message-dispatch-bulk',
  PROVIDER_SEND = 'provider-send',
  FALLBACK_RETRY = 'fallback-retry',
  WEBHOOK_INGEST = 'webhook-ingest',
  CALLBACK = 'callback',
  CUSTOMER_WEBHOOK_DISPATCH = 'customer-webhook-dispatch',
}

export enum EventSource {
  WORKER = 'worker',
  WEBHOOK = 'webhook',
  CLIENT = 'client',
  SYSTEM = 'system',
  ROUTER = 'router',
}

export enum EventType {
  ROUTING_RESOLVED = 'routing.resolved',
  POLICY_RATE_LIMITED = 'policy.rate_limited',
  POLICY_BUDGET_EXCEEDED = 'policy.budget_exceeded',
  SUPPRESSION_BLOCKED = 'suppression.blocked',
  DELIVERY_ACCEPTED = 'delivery.accepted',
  DELIVERY_DELIVERED = 'delivery.delivered',
  ATTEMPT_RETRYING = 'attempt.retrying',
  ATTEMPT_FAILED = 'attempt.failed',
  CASCADE_STEP_INITIATED = 'cascade.step_initiated',
  CASCADE_SHORT_CIRCUITED = 'cascade.short_circuited',
  CASCADE_EXHAUSTED = 'cascade.exhausted',
}

export enum CascadeState {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SHORT_CIRCUITED = 'short_circuited',
  EXHAUSTED = 'exhausted',
}

export enum IdentifierType {
  EMAIL = 'email',
  PHONE = 'phone',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  PUSH = 'push',
  USER_ID = 'user_id',
}

export enum SystemProvider {
  SYSTEM = 'system',
  CLIENT_RECEIPT = 'client-receipt',
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  SEND_FAILED = 'SEND_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class SystemOverloadError extends Error {
  public readonly code = ErrorCode.SERVICE_UNAVAILABLE;
  public readonly retryAfterSeconds: number;

  constructor(message = 'System under extreme load, please retry later', retryAfterSeconds = 5) {
    super(message);
    this.name = 'SystemOverloadError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DomainValidationError extends Error {
  public readonly code = ErrorCode.VALIDATION_ERROR;

  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export enum JobName {
  PROCESS_WEBHOOK = 'process-webhook',
  PROCESS_OPEN_PIXEL = 'process-open-pixel',
  SEND_PROVIDER = 'send-provider',
  MESSAGE_DISPATCH = 'message-dispatch',
  TRIGGER_FALLBACK = 'trigger-fallback',
  FALLBACK_RETRY = 'fallback-retry',
  PROCESS_CASCADE_STEP = 'process-cascade-step',
}

export enum WebhookStatus {
  UNAUTHORIZED = 'unauthorized',
  DUPLICATE_IGNORED = 'duplicate_ignored',
  ACCEPTED = 'accepted',
}

export const ClientReceiptSchema = z
  .object({
    messageId: z.string().min(1),
    channel: z.string().optional(),
    event: z.string().optional(),
  })
  .passthrough();

export type ClientReceiptPayload = z.infer<typeof ClientReceiptSchema>;

export const RecipientSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(), // Normalized E.164 phone
  whatsapp: z.string().optional(),
  telegramChatId: z.string().optional(),
  slack: z.object({ channelId: z.string() }).optional(),
  fcmTokens: z.array(z.string()).optional(),
  apnsTokens: z.array(z.string()).optional(),
});

export type Recipients = z.infer<typeof RecipientSchema>;

export enum TenantTier {
  ENTERPRISE = 'enterprise',
  PRO = 'pro',
  FREE = 'free',
}

export const EmailChannelContentSchema = z.object({
  subject: z.string(),
  html: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
  render: z
    .object({
      template: z.string(),
      version: z.string().optional().nullable(),
      locale: z.string().optional().nullable(),
      props: z.record(z.string(), z.unknown()).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const EmailChannelRequestSchema = z.object({
  channel: z.literal(Channel.EMAIL),
  content: EmailChannelContentSchema,
});

export const SmsChannelContentSchema = z.object({
  text: z.string(),
});

export const SmsChannelRequestSchema = z.object({
  channel: z.literal(Channel.SMS),
  content: SmsChannelContentSchema,
});

export const WhatsAppChannelContentSchema = z.object({
  text: z.string().optional(),
  template: z.string().optional(),
  language: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const WhatsAppChannelRequestSchema = z.object({
  channel: z.literal(Channel.WHATSAPP),
  content: WhatsAppChannelContentSchema,
});

export enum TelegramParseMode {
  HTML = 'HTML',
  MARKDOWN_V2 = 'MarkdownV2',
}

export const TelegramChannelContentSchema = z.object({
  text: z.string(),
  parseMode: z.nativeEnum(TelegramParseMode).optional(),
});

export const TelegramChannelRequestSchema = z.object({
  channel: z.literal(Channel.TELEGRAM),
  content: TelegramChannelContentSchema,
});

export const SlackChannelContentSchema = z.object({
  text: z.string(),
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const SlackChannelRequestSchema = z.object({
  channel: z.literal(Channel.SLACK),
  content: SlackChannelContentSchema,
});

export const FcmChannelContentSchema = z.object({
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.string()).optional(),
});

export const FcmChannelRequestSchema = z.object({
  channel: z.literal(Channel.FCM),
  content: FcmChannelContentSchema,
});

export const ApnsChannelContentSchema = z.object({
  title: z.string(),
  body: z.string(),
  badge: z.number().optional(),
  sound: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const ApnsChannelRequestSchema = z.object({
  channel: z.literal(Channel.APNS),
  content: ApnsChannelContentSchema,
});

export const ChannelRequestSchema = z.discriminatedUnion('channel', [
  EmailChannelRequestSchema,
  SmsChannelRequestSchema,
  WhatsAppChannelRequestSchema,
  TelegramChannelRequestSchema,
  SlackChannelRequestSchema,
  FcmChannelRequestSchema,
  ApnsChannelRequestSchema,
]);

export type ChannelRequest = z.infer<typeof ChannelRequestSchema>;

// Fallback Rules
export enum FallbackEvent {
  FAILED = 'failed',
  NOT_DELIVERED = 'not_delivered',
  NOT_READ = 'not_read',
}

export const FallbackRuleSchema = z.object({
  when: z.object({
    channel: z.nativeEnum(Channel).or(z.string()),
    event: z.nativeEnum(FallbackEvent),
    afterSeconds: z.number().optional(),
  }),
  send: z.array(
    z.object({
      channel: z.nativeEnum(Channel).or(z.string()),
      content: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export const FallbackConfigSchema = z.object({
  rules: z.array(FallbackRuleSchema),
});

// Omnichannel Cascade Schemas
export enum CascadeTrigger {
  IF_UNOPENED = 'if_unopened',
  IF_UNDELIVERED = 'if_undelivered',
  ALWAYS = 'always',
  IF_UNCONVERTED = 'if_unconverted',
}

export enum CascadeCondition {
  IF_UNOPENED = 'if_unopened',
  IF_UNDELIVERED = 'if_undelivered',
  ALWAYS = 'always',
  IF_UNCONVERTED = 'if_unconverted',
}

export enum CascadeCancelEvent {
  DELIVERED = 'DELIVERED',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  CONVERTED = 'CONVERTED',
}

export const CascadeStepSchema = z.object({
  channel: z.nativeEnum(Channel),
  providerId: z.string().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  waitForReceiptMs: z.number().min(0).max(3600000).optional(), // Default wait before falling back to next step
  condition: z.nativeEnum(CascadeCondition).or(z.nativeEnum(CascadeTrigger)).optional(),
  triggerOn: z.nativeEnum(CascadeTrigger).optional(),
});

export type CascadeStep = z.infer<typeof CascadeStepSchema>;

export const CascadeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  steps: z.array(CascadeStepSchema).min(1),
  cancelOnEvent: z.array(z.nativeEnum(CascadeCancelEvent)).optional(),
});

export type CascadeConfig = z.infer<typeof CascadeConfigSchema>;

// Template Engine Schemas
export const TemplateSpecSchema = z.object({
  id: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  locale: z.string().optional(),
});

export type TemplateSpec = z.infer<typeof TemplateSpecSchema>;

export const TemplatePreviewRequestSchema = z.object({
  template: TemplateSpecSchema,
  variables: z.record(z.string(), z.unknown()).default({}),
  recipient: RecipientSchema.optional(),
});

export type TemplatePreviewRequest = z.infer<typeof TemplatePreviewRequestSchema>;

// DLQ Mutated Replay Schema
export const DlqMutatedReplaySchema = z.object({
  messageIds: z.array(z.string()).min(1, 'messageIds array must contain at least 1 message ID'),
  mutations: z
    .object({
      recipients: RecipientSchema.partial().optional(),
      channels: z.array(ChannelRequestSchema).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  isSandbox: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export type DlqMutatedReplayRequest = z.infer<typeof DlqMutatedReplaySchema>;

// Delivery Trace APM Waterfall Types
export enum SpanStatus {
  OK = 'OK',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface TraceSpan {
  spanId: string;
  name: string;
  status: SpanStatus;
  startOffsetMs: number;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface DeliveryTraceResponse {
  messageId: string;
  state: MessageState;
  team: string;
  category: string;
  totalDurationMs: number;
  summary: {
    ingestedAt: string;
    completedAt?: string;
    deliveredAt?: string;
    chosenProvider?: string;
    costUsd?: number;
    attemptsCount: number;
  };
  waterfall: TraceSpan[];
}

// Master Send Message Request Schema
export const SendMessageRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
  userId: z.string().min(1),
  team: z.string().min(1),
  category: z.string().min(1),
  country: z.string().length(2),
  campaignId: z.string().optional().nullable(),
  priority: z.nativeEnum(MessagePriority).default(MessagePriority.NORMAL),
  scheduledAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  recipients: RecipientSchema,
  channels: z.array(ChannelRequestSchema).min(1),
  template: TemplateSpecSchema.optional().nullable(),
  variables: z.record(z.string(), z.unknown()).optional().nullable(),
  fallback: FallbackConfigSchema.optional().nullable(),
  cascade: CascadeConfigSchema.optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const BulkSendMessageRequestSchema = z.object({
  messages: z.array(SendMessageRequestSchema).min(1).max(500),
});

export type BulkSendMessageRequest = z.infer<typeof BulkSendMessageRequestSchema>;
