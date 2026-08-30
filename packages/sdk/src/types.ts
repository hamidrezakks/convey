/**
 * @convey/sdk - Type Definitions and Contracts
 * Comprehensive domain types, request payloads, response DTOs, and client options.
 */

import type { ConveyMiddleware } from './middleware';

// ==========================================
// 1. Core Domain Enums
// ==========================================

export enum Channel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
  SLACK = 'SLACK',
  TOOL = 'TOOL',
  VOICE = 'VOICE',
  IN_APP = 'IN_APP',
  DISCORD = 'DISCORD',
  TELEGRAM = 'TELEGRAM',
  WEBHOOK = 'WEBHOOK',
}

export enum MessagePriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  DEFAULT = 'DEFAULT',
  LOW = 'LOW',
}

export enum MessageStatus {
  ACCEPTED = 'ACCEPTED',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SUPPRESSED = 'SUPPRESSED',
  REPLAYED = 'REPLAYED',
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  HALF_OPEN = 'HALF_OPEN',
  OPEN = 'OPEN',
}

export enum SuppressionReason {
  HARD_BOUNCE = 'HARD_BOUNCE',
  SPAM_COMPLAINT = 'SPAM_COMPLAINT',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  MANUAL_BLOCK = 'MANUAL_BLOCK',
}

export enum DlqFailureCategory {
  PROVIDER_5XX = 'PROVIDER_5XX',
  RATE_LIMIT_429 = 'RATE_LIMIT_429',
  INVALID_RECIPIENT_400 = 'INVALID_RECIPIENT_400',
  AUTH_EXPIRED_401 = 'AUTH_EXPIRED_401',
  TIMEOUT_504 = 'TIMEOUT_504',
  POLICY_REJECTED = 'POLICY_REJECTED',
  UNKNOWN = 'UNKNOWN',
}

export enum UserRole {
  ORG_ADMIN = 'ORG_ADMIN',
  TEAM_ADMIN = 'TEAM_ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
}

export enum BatchState {
  INITIALIZING = 'INITIALIZING',
  PROCESSING = 'PROCESSING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export type ChannelType = Channel | `${Channel}` | Lowercase<`${Channel}`>;
export type MessagePriorityType = MessagePriority | `${MessagePriority}` | Lowercase<`${MessagePriority}`>;
export type MessageStatusType = MessageStatus | `${MessageStatus}` | Lowercase<`${MessageStatus}`>;
export type SuppressionReasonType = SuppressionReason | `${SuppressionReason}` | Lowercase<`${SuppressionReason}`>;
export type CircuitStateType = CircuitState | `${CircuitState}` | Lowercase<`${CircuitState}`>;
export type BatchStateType = BatchState | `${BatchState}` | Lowercase<`${BatchState}`>;

// ==========================================
export interface RetryPolicy {
  /**
   * Maximum retry attempts for rate-limited (429) or transient server errors (5xx).
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial backoff delay in milliseconds.
   * @default 100
   */
  initialBackoffMs?: number;

  /**
   * Maximum backoff delay in milliseconds.
   * @default 10000
   */
  maxBackoffMs?: number;

  /**
   * Backoff rate progression strategy.
   * @default 'exponential'
   */
  strategy?: 'exponential' | 'linear' | 'fixed';

  /**
   * Jitter randomization scheme to prevent thundering herd.
   * @default 'full'
   */
  jitter?: 'full' | 'equal' | 'none';

  /**
   * Custom filter determining whether a specific error should be retried.
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface ConveyClientOptions {
  /**
   * Convey API Key (e.g. `sk_live_...` or `sk_test_...`).
   * Optional if `process.env.CONVEY_API_KEY` is set.
   */
  apiKey?: string;

  /**
   * Base URL for the Convey API.
   * MANDATORY unless `environment` preset or `CONVEY_BASE_URL` env var is specified.
   */
  baseUrl?: string;

  /**
   * Environment preset identifier (e.g. `PRODUCTION`, `US`, `EU`, `STAGING`, `LOCAL`, `SANDBOX`).
   */
  environment?:
    | 'production'
    | 'staging'
    | 'eu'
    | 'us'
    | 'local'
    | 'sandbox'
    | 'PRODUCTION'
    | 'STAGING'
    | 'EU'
    | 'US'
    | 'LOCAL'
    | 'SANDBOX'
    | string;

  /**
   * Request timeout in milliseconds.
   * @default 10000 (10 seconds)
   */
  timeoutMs?: number;

  /**
   * Maximum retry attempts for rate-limited (429) or transient server errors (5xx).
   * @default 3
   */
  maxRetries?: number;

  /**
   * Advanced retry policy configuration.
   */
  retryPolicy?: RetryPolicy;

  /**
   * Client-side rate smoother configuration (Token Bucket).
   */
  rateLimiter?: { maxRequestsPerSecond: number; maxBurst?: number } | boolean;

  /**
   * Pluggable structured logger.
   */
  logger?: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };

  /**
   * Logging verbosity level.
   * @default 'silent'
   */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';

  /**
   * Middleware / Interceptor chain.
   */
  middlewares?: ConveyMiddleware[];

  /**
   * When true, requests are routed to the simulated sandbox engine.
   * @default false
   */
  isSandbox?: boolean;

  /**
   * Default team identifier scope for requests.
   */
  teamId?: string;

  /**
   * Custom fetch implementation (useful for edge runtimes, caching proxies, or testing).
   */
  fetch?: typeof fetch;

  /**
   * Default headers to attach to all outgoing requests.
   */
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  /**
   * Per-request custom base URL override.
   */
  baseUrl?: string;

  /**
   * Custom timeout for this specific request in milliseconds.
   */
  timeoutMs?: number;

  /**
   * Custom retry count for this specific request.
   */
  maxRetries?: number;

  /**
   * Explicit idempotency key for exactly-once execution.
   */
  idempotencyKey?: string;

  /**
   * Explicit W3C traceparent header.
   */
  traceparent?: string;

  /**
   * Override sandbox mode for this specific request.
   */
  isSandbox?: boolean;

  /**
   * External AbortSignal for request cancellation.
   */
  signal?: AbortSignal;

  /**
   * Additional HTTP headers for this request.
   */
  headers?: Record<string, string>;

  /**
   * HTTP Method (GET, POST, PUT, DELETE, PATCH).
   */
  method?: string;

  /**
   * Request payload body.
   */
  body?: unknown;

  /**
   * URL Query parameters.
   */
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;

  /**
   * Expected response serialization type.
   */
  responseType?: 'json' | 'text' | 'blob';
}

// ==========================================
// 3. Messages & Delivery Payloads
// ==========================================

export interface MessageContent<TVariables = Record<string, unknown>> {
  subject?: string;
  title?: string;
  body?: string;
  text?: string;
  templateId?: string;
  variables?: TVariables;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 or URL
    contentType?: string;
  }>;
}

export interface SendMessageRequest<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>> {
  channel?: ChannelType;
  recipient?: string;
  priority?: MessagePriorityType;
  content?: MessageContent<TVariables>;
  category?: string;
  campaignId?: string;
  metadata?: TMetadata;
  idempotencyKey?: string;
  scheduledAt?: string | Date;
  // Full wire properties (optional)
  userId?: string;
  team?: string;
  country?: string;
  recipients?: Record<string, unknown>;
  channels?: Array<{
    channel: string;
    content?: Record<string, unknown>;
  }>;
  template?: {
    id?: string;
    subject?: string;
    body?: string;
    html?: string;
    text?: string;
    locale?: string;
  };
  fallback?: Record<string, unknown>;
  cascade?: Record<string, unknown>;
  variables?: TVariables;
}

export interface MessageAcceptedResponse {
  messageId: string;
  publicId: string;
  state: string;
  status: MessageStatus;
  createdAt: string;
  acceptedAt: string;
  scheduledAt?: string;
  success?: boolean;
  channel?: ChannelType;
  recipient?: string;
  priority?: MessagePriorityType;
  isSandbox?: boolean;
  idempotencyKey?: string;
}

export interface BulkSendMessageRequest<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>> {
  messages: Array<SendMessageRequest<TVariables, TMetadata>>;
}

export interface BulkMessageResponse {
  total: number;
  items: MessageAcceptedResponse[];
}

export interface TraceSpan {
  id: string;
  name: string;
  serviceName: string;
  startTimeMs: number;
  durationMs: number;
  status: 'OK' | 'ERROR' | string;
  attributes?: Record<string, string | number | boolean>;
}

export interface MessageAttemptDto {
  attemptNumber: number;
  providerId: string;
  status: string;
  responseCode?: number;
  errorDetails?: string;
  latencyMs: number;
  attemptedAt: string;
}

export interface MessageDetailDto {
  publicId: string;
  messageId?: string;
  teamId: string;
  channel: Channel;
  recipient: string;
  priority: MessagePriority;
  status: MessageStatus;
  isSandbox?: boolean;
  providerId?: string;
  failureCategory?: string;
  errorReason?: string;
  retryCount?: number;
  latencyMs?: number;
  costUsd?: number;
  createdAt: string;
  deliveredAt?: string;
  traceparent?: string;
  content: {
    subject?: string;
    body?: string;
    templateId?: string;
    variables?: Record<string, unknown>;
  };
  encryption?: {
    isEncrypted: boolean;
    algorithm: string;
    kmsKeyId?: string;
  };
  spans: TraceSpan[];
  attempts: MessageAttemptDto[];
  timeline?: Array<{
    status: MessageStatus;
    provider?: string;
    attemptNumber?: number;
    latencyMs?: number;
    timestamp: string;
    error?: string;
  }>;
}

export interface MessageTimelineResponse {
  messageId: string;
  timeline: Array<{
    status: MessageStatus;
    provider?: string;
    attemptNumber?: number;
    latencyMs?: number;
    timestamp: string;
    error?: string;
  }>;
}

export interface MessageTraceResponse {
  messageId: string;
  traceparent: string;
  totalDurationMs: number;
  spans: TraceSpan[];
}

export interface TemplatePreviewRequest {
  template:
    | string
    | {
        id?: string;
        subject?: string;
        body?: string;
        html?: string;
        text?: string;
        locale?: string;
      };
  variables?: Record<string, unknown>;
  recipient?: string | Record<string, unknown>;
}

export interface TemplatePreviewResponse {
  subject?: string;
  body?: string;
  text?: string;
  html?: string;
  rendered?: string;
  missingVariables?: string[];
}

// ==========================================
// 4. Batches
// ==========================================

export interface CreateBatchRequest {
  totalCount: number;
  metadata?: Record<string, unknown>;
}

export interface BatchDto {
  id: string;
  batchId?: string;
  tenantId: string;
  team: string;
  totalCount: number;
  processedCount: number;
  state: BatchState;
  status?: BatchState;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBatchResponse {
  success: boolean;
  batch: BatchDto;
}

export interface ListBatchesResponse {
  success: boolean;
  batches: BatchDto[];
}

export interface BatchActionResponse {
  success: boolean;
  batch: BatchDto;
  batchId?: string;
  status?: BatchState;
  processedCount?: number;
  totalCount?: number;
}

// ==========================================
// 5. Suppressions
// ==========================================

export interface AddSuppressionRequest {
  identifier?: string;
  recipient?: string;
  identifierType?: 'email' | 'phone' | 'whatsapp' | 'push' | 'user_id' | string;
  reason: SuppressionReasonType;
  category?: string;
  country?: string;
  channel?: ChannelType;
  startsAt?: string | Date;
  endsAt?: string | Date;
}

export interface BulkAddSuppressionsRequest {
  items: AddSuppressionRequest[];
}

export interface SuppressionDto {
  id: string;
  teamId: string;
  identifier: string;
  recipient?: string;
  identifierType?: string;
  reason: SuppressionReason;
  category?: string;
  country?: string;
  channel?: Channel;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface ListSuppressionsQuery {
  limit?: number;
  offset?: number;
  channel?: Channel;
  category?: string;
  reason?: SuppressionReason;
  search?: string;
}

export interface ListSuppressionsResponse {
  items: SuppressionDto[];
  total: number;
  limit: number;
  offset: number;
}

// ==========================================
// 6. Webhooks & Subscriptions
// ==========================================

export interface CreateWebhookSubscriptionRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookSubscriptionDto {
  id: string;
  tenantId: string;
  team: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  successRate?: string;
  avgLatencyMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookSubscriptionResponse {
  success: boolean;
  subscription: WebhookSubscriptionDto;
}

export interface ListWebhookSubscriptionsResponse {
  subscriptions: WebhookSubscriptionDto[];
}

export interface ConveyWebhookEvent<TData = Record<string, unknown>> {
  id: string;
  type:
    | 'message.accepted'
    | 'message.queued'
    | 'message.sending'
    | 'message.delivered'
    | 'message.failed'
    | 'message.opened'
    | 'message.read'
    | 'message.suppressed'
    | 'ping.test'
    | string;
  timestamp?: string;
  createdAt?: string;
  tenantId?: string;
  team?: string;
  teamId?: string;
  data: TData;
}

// ==========================================
// 7. Dead-Letter Queue (DLQ)
// ==========================================

export interface ListDlqQuery {
  team?: string;
  limit?: number;
  offset?: number;
}

export interface ListDlqResponse {
  items: MessageDetailDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface DlqReplayRequest {
  messageIds: string[];
}

export interface DlqReplayResult {
  replayedCount: number;
  messageIds: string[];
}

export interface DlqMutatedReplayRequest {
  messageIds?: string[];
  dryRun?: boolean;
  category?: DlqFailureCategory;
  filter?: {
    errorCategory?: DlqFailureCategory;
    providerId?: string;
    timeRange?: 'last_hour' | 'last_2_hours' | 'last_24_hours' | 'all';
    messageIds?: string[];
  };
  replayConfig?: {
    concurrency: number;
    backoffJitterMs: number;
  };
}

export interface DlqMutatedReplayResult {
  dryRun: boolean;
  matchedMessagesCount: number;
  replayedCount?: number;
  failedCount?: number;
  messages?: string[];
  simulation?: {
    estimatedSuccessRatePercent: number;
    estimatedApiCostUsd: number;
    estimatedExecutionTimeSeconds: number;
    affectedTenantsCount: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  };
}

// ==========================================
// 8. Sandbox
// ==========================================

export interface ListSandboxMessagesResponse {
  messages: MessageDetailDto[];
}

export interface ClearSandboxMessagesResponse {
  success: boolean;
  count: number;
}

// ==========================================
// 9. Reporting & Multi-Dimension Analytics
// ==========================================

export interface ReportingMetrics {
  sent: number;
  delivered: number;
  opened: number;
  read: number;
  failed: number;
  deliveryRatePercent: number;
  openRatePercent: number;
  failRatePercent: number;
  totalCostUsd: number;
  avgLatencyMs?: number;
}

export interface ReportingQueryParams {
  startDate?: string;
  endDate?: string;
  range?: string;
  teamId?: string;
  category?: string;
  campaignId?: string;
  isSandbox?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ReportingOverviewResponse {
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalRead: number;
    totalFailed: number;
    deliveryRatePercent: number;
    openRatePercent: number;
    failRatePercent: number;
    totalCostUsd: number;
    activeTeamsCount?: number;
    activeCampaignsCount?: number;
    deliveryRate?: number;
    totalBounced?: number;
    avgLatencyMs?: number;
  };
  channelBreakdown: Array<{
    channel: Channel;
    sent?: number;
    delivered?: number;
    opened?: number;
    read?: number;
    failed?: number;
    costUsd?: number;
    deliveryRate?: number;
  }>;
  timeSeries: Array<{
    timestamp: string;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
    costUsd: number;
  }>;
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

export interface TeamReportDto {
  teamId: string;
  teamName?: string;
  currency: string;
  monthlyBudget: number;
  usedBudgetUsd: number;
  remainingBudgetUsd: number;
  budgetUtilizationPercent: number;
  isHardStop?: boolean;
  metrics: ReportingMetrics;
  activeCampaignsCount: number;
}

export interface TeamsReportResponse {
  teams: TeamReportDto[];
  total?: number;
}

export interface CategoryReportDto {
  category: string;
  totalSent: number;
  delivered?: number;
  opened?: number;
  read?: number;
  failed?: number;
  deliveryRatePercent: number;
  openRatePercent: number;
  failRatePercent: number;
  totalCostUsd: number;
  topChannel: Channel;
}

export interface CategoriesReportResponse {
  categories: CategoryReportDto[];
  total?: number;
}

export interface CampaignReportDto {
  campaignId: string;
  name: string;
  team: string;
  category: string;
  state: string;
  metrics: ReportingMetrics;
  costPerDeliveredUsd: number;
  firstDispatchedAt?: string;
  lastDispatchedAt?: string;
}

export interface CampaignsReportResponse {
  campaigns: CampaignReportDto[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface CampaignDetailDto extends CampaignReportDto {
  funnel: {
    accepted: number;
    dispatched: number;
    delivered: number;
    opened: number;
    read: number;
    failed: number;
    deliveryRatePercent?: number;
    openRatePercent?: number;
    readRatePercent?: number;
  };
  channelBreakdown: Array<{
    channel: Channel;
    sent: number;
    delivered: number;
    opened?: number;
    read?: number;
    failed?: number;
    costUsd: number;
  }>;
  hourlyTimeline: Array<{
    hour: string;
    sent: number;
    delivered: number;
    opened?: number;
    read?: number;
    failed: number;
    costUsd: number;
  }>;
}

// ==========================================
// 10. Admin Studio & Telemetry
// ==========================================

export interface LiveTelemetrySnapshot {
  timestamp: string;
  throughputRps: number;
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    slaBreachThresholdMs: number;
  };
  queues: {
    outboxRelayDepth: number;
    messageDispatchDepth: number;
    providerSendDepth: number;
    scheduledPromoterDepth: number;
    customerWebhookDepth: number;
    activeWorkersCount: number;
    autoscalerTargetConcurrency: number;
    outboxBacklog?: number;
    providerQueues?: Record<string, { waiting: number; active: number; failed: number }>;
  };
  runtimeGuard: {
    v8HeapUsedMb: number;
    v8HeapTotalMb: number;
    v8HeapSaturationPercent: number;
    heapGuardThresholdPercent: number;
    eventLoopLagMs: number;
    loadSheddingActive: boolean;
    heapUsedMb?: number;
    heapTotalMb?: number;
  };
  subsystems: {
    postgresPool: {
      status: 'healthy' | 'degraded' | 'error' | string;
      activeConnections: number;
      idleConnections: number;
    };
    redisCluster: { status: 'healthy' | 'degraded' | 'error' | string; usedMemoryMb: number; rttMs: number };
    activePartition: string;
    circuitBreakers: { total: number; closed: number; halfOpen: number; open: number };
  };
  recentActivity: Array<{
    id: string;
    type: string;
    channel: Channel;
    teamId: string;
    provider: string;
    latencyMs: number;
    status: MessageStatus;
    timestamp: string;
  }>;
}

export interface ProviderHealthDto {
  providerId: string;
  displayName: string;
  channel: Channel;
  state: CircuitState;
  rampPercentage: number;
  emaLatencyMs: number;
  rollingSuccessRatePercent: number;
  anomalyZScore: number;
  unitCostUsd: number;
  totalCalls24h: number;
  lastTripAt?: string;
  isCanaryHealthy: boolean;
}

export interface RegisterProviderRequest {
  providerId: string;
  channel: Channel;
  credentials: Record<string, string>;
  baseCurrency?: string;
  unitCost?: number;
  config?: Record<string, unknown>;
  isPrimary?: boolean;
  priority?: number;
  weight?: number;
  fallbackProviderId?: string;
}

export interface TestProviderConnectionRequest {
  providerId: string;
  credentials: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface TestProviderConnectionResult {
  success: boolean;
  providerId: string;
  latencyMs: number;
  message: string;
  testedAt: string;
}

export interface AuditLogDto {
  id: string;
  tenantId: string;
  team: string;
  actor: string;
  actorRole: UserRole;
  action: string;
  target: string;
  ipAddress?: string;
  sha256Hash: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  tenantId?: string;
  team?: string;
  action?: string;
}

export interface ListAuditLogsResponse {
  items: AuditLogDto[];
  logs?: AuditLogDto[];
  total: number;
  page: number;
  limit: number;
}

// ==========================================
// 10. Content & Template Lifecycle Types
// ==========================================

export type TemplateCategory = 'transactional' | 'marketing' | 'alert' | 'system';

export type WhatsAppHeaderType = 'text' | 'image' | 'video' | 'document' | 'location';

export interface WhatsAppHeader {
  type: WhatsAppHeaderType;
  text?: string;
  mediaUrl?: string;
  filename?: string;
}

export type WhatsAppButtonType = 'quick_reply' | 'url' | 'phone_number' | 'copy_code';

export interface WhatsAppButton {
  type: WhatsAppButtonType;
  text: string;
  id?: string;
  url?: string;
  phoneNumber?: string;
  code?: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

export interface WhatsAppInteractiveList {
  buttonText: string;
  title?: string;
  sections: WhatsAppListSection[];
}

export interface WhatsAppLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppChannelConfig {
  templateName?: string;
  languageCode?: string;
  parameters?: string[];
  header?: WhatsAppHeader;
  body?: string;
  footer?: string;
  buttons?: WhatsAppButton[];
  interactiveList?: WhatsAppInteractiveList;
  location?: WhatsAppLocation;
}

export type PushInterruptionLevel = 'passive' | 'active' | 'time-sensitive' | 'critical';

export interface PushActionButton {
  id: string;
  title: string;
  icon?: string;
  isDestructive?: boolean;
  isAuthenticationRequired?: boolean;
  type?: 'button' | 'text_input';
  placeholder?: string;
}

export interface PushAndroidConfig {
  channelId?: string;
  color?: string;
  priority?: 'high' | 'normal' | 'min';
  visibility?: 'public' | 'private' | 'secret';
  sticky?: boolean;
  tag?: string;
  icon?: string;
}

export interface PushWebPushConfig {
  requireInteraction?: boolean;
  vibrate?: number[];
  tag?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
  lang?: string;
  renotify?: boolean;
  silent?: boolean;
}

export interface PushChannelConfig {
  title: string;
  body: string;
  subtitle?: string;
  imageUrl?: string;
  iconUrl?: string;
  badge?: number;
  sound?: string;
  actionButtons?: PushActionButton[];
  interruptionLevel?: PushInterruptionLevel;
  threadId?: string;
  mutableContent?: boolean;
  clickActionUrl?: string;
  android?: PushAndroidConfig;
  webpush?: PushWebPushConfig;
  data?: Record<string, unknown>;
}

export interface EmailAttachment {
  filename: string;
  content?: string;
  contentType?: string;
  sizeBytes?: number;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailTrackingConfig {
  openTracking?: boolean;
  clickTracking?: boolean;
  unsubscribeTracking?: boolean;
}

export interface EmailBrandTheme {
  primaryColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  logoHeightPx?: number;
}

export interface EmailChannelConfig {
  subject: string;
  html?: string;
  text?: string;
  mjml?: string;
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  tags?: string[];
  tracking?: EmailTrackingConfig;
  brandTheme?: EmailBrandTheme;
  ampHtml?: string;
}

export interface TemplateChannelConfig {
  email?: EmailChannelConfig;
  sms?: {
    body?: string;
  };
  push?: PushChannelConfig;
  chat?: {
    body?: string;
  };
  whatsapp?: WhatsAppChannelConfig;
}

export interface TemplateVersionDto {
  id: string;
  templateId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  schema: Record<string, unknown>;
  channels: TemplateChannelConfig;
  translations: Record<string, Partial<TemplateChannelConfig>>;
  author?: string;
  changeSummary?: string;
  createdAt: string;
}

export interface TemplateDto {
  id: string;
  publicId: string;
  tenantId: string;
  team: string;
  environment: string;
  slug: string;
  name: string;
  category: TemplateCategory;
  defaultLocale: string;
  publishedVersionId?: string;
  publishedVersion?: TemplateVersionDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  slug: string;
  name: string;
  category?: TemplateCategory;
  defaultLocale?: string;
  initialVersion?: {
    version: string;
    channels: TemplateChannelConfig;
    translations?: Record<string, Partial<TemplateChannelConfig>>;
    changeSummary?: string;
  };
}

export interface CreateTemplateVersionRequest {
  version: string;
  channels: TemplateChannelConfig;
  translations?: Record<string, Partial<TemplateChannelConfig>>;
  changeSummary?: string;
}

export interface RenderTemplateRequest {
  templateSlug?: string;
  templateSpec?: TemplateChannelConfig;
  channel: Channel | string;
  variables?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  locale?: string;
}

export interface RenderTemplateResponse {
  channel: string;
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
  renderedEmail?: EmailChannelConfig;
  renderedWhatsApp?: WhatsAppChannelConfig;
  renderedPush?: PushChannelConfig;
  localeUsed: string;
  resolvedPartials: string[];
}

export interface TemplatePartialDto {
  id: string;
  tenantId: string;
  team: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 11. Preferences & Consent Governance Types
// ==========================================

export interface SubscriptionTopicDto {
  id: string;
  tenantId: string;
  team: string;
  key: string;
  name: string;
  description?: string;
  isMandatory: boolean;
  defaultChannels: Channel[] | string[];
  createdAt: string;
}

export interface RecipientPreferencesDto {
  id: string;
  tenantId: string;
  team: string;
  recipientId: string;
  email?: string;
  phone?: string;
  timezone: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  channelPreferences: Record<string, boolean>;
  topicPreferences: Record<string, boolean>;
  unsubscribeToken: string;
  updatedAt: string;
}

export interface PreferenceCheckResult {
  allowed: boolean;
  reason?: 'DISABLED_CHANNEL' | 'OPTED_OUT_TOPIC' | 'IN_QUIET_HOURS';
}

// ==========================================
// 12. In-App Inbox Notification Types
// ==========================================

export interface InAppNotificationDto {
  id: string;
  tenantId: string;
  team: string;
  recipientId: string;
  title: string;
  body: string;
  ctaUrl?: string;
  iconUrl?: string;
  category: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  createdAt: string;
}

export interface InAppFeedResponse {
  unreadCount: number;
  totalCount: number;
  items: InAppNotificationDto[];
}
