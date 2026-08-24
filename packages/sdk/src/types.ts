/**
 * @convey/sdk - Type Definitions and Contracts
 * Comprehensive domain types, request payloads, response DTOs, and client options.
 */

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

// ==========================================
// 2. Client Configuration & Request Options
// ==========================================

export interface ConveyClientOptions {
  /**
   * Convey API Key (e.g. `sk_live_...` or `sk_test_...`)
   */
  apiKey: string;

  /**
   * Base URL for the Convey API.
   * @default 'http://localhost:3000' (or process.env.CONVEY_BASE_URL)
   */
  baseUrl?: string;

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
  body?: string;
  templateId?: string;
  variables?: TVariables;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 or URL
    contentType?: string;
  }>;
}

export interface SendMessageRequest<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>> {
  channel?: Channel | `${Channel}` | string;
  recipient?: string;
  priority?: MessagePriority | `${MessagePriority}` | string;
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
  status: MessageStatus | `${MessageStatus}` | string;
  createdAt: string;
  acceptedAt: string;
  scheduledAt?: string;
  success?: boolean;
  channel?: Channel | `${Channel}` | string;
  recipient?: string;
  priority?: MessagePriority | `${MessagePriority}` | string;
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
  teamId: string;
  channel: Channel | `${Channel}` | string;
  recipient: string;
  priority: MessagePriority | `${MessagePriority}` | string;
  status: MessageStatus | `${MessageStatus}` | string;
  isSandbox?: boolean;
  providerId?: string;
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
    status: MessageStatus | `${MessageStatus}` | string;
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
    status: MessageStatus | `${MessageStatus}` | string;
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
  tenantId: string;
  team: string;
  totalCount: number;
  processedCount: number;
  state: BatchState | `${BatchState}` | string;
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
}

// ==========================================
// 5. Suppressions
// ==========================================

export interface AddSuppressionRequest {
  identifier: string;
  identifierType?: 'email' | 'phone' | 'whatsapp' | 'push' | 'user_id' | string;
  reason: SuppressionReason | `${SuppressionReason}` | string;
  category?: string;
  country?: string;
  channel?: Channel | `${Channel}` | string;
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
  identifierType?: string;
  reason: SuppressionReason | `${SuppressionReason}` | string;
  category?: string;
  country?: string;
  channel?: Channel | `${Channel}` | string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface ListSuppressionsQuery {
  limit?: number;
  offset?: number;
  channel?: Channel | `${Channel}` | string;
  category?: string;
  reason?: SuppressionReason | `${SuppressionReason}` | string;
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
  timestamp: string;
  tenantId: string;
  team: string;
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
  dryRun?: boolean;
  category?: DlqFailureCategory | `${DlqFailureCategory}` | string;
  filter?: {
    errorCategory?: DlqFailureCategory | `${DlqFailureCategory}` | string;
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
  };
  channelBreakdown: Array<{
    channel: Channel | `${Channel}` | string;
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
  topChannel: Channel | `${Channel}` | string;
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
    channel: Channel | `${Channel}` | string;
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
  };
  runtimeGuard: {
    v8HeapUsedMb: number;
    v8HeapTotalMb: number;
    v8HeapSaturationPercent: number;
    heapGuardThresholdPercent: number;
    eventLoopLagMs: number;
    loadSheddingActive: boolean;
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
    channel: Channel | `${Channel}` | string;
    teamId: string;
    provider: string;
    latencyMs: number;
    status: MessageStatus | `${MessageStatus}` | string;
    timestamp: string;
  }>;
}

export interface ProviderHealthDto {
  providerId: string;
  displayName: string;
  channel: Channel | `${Channel}` | string;
  state: CircuitState | `${CircuitState}` | string;
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
  channel: Channel | `${Channel}` | string;
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
  actorRole: UserRole | `${UserRole}` | string;
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
