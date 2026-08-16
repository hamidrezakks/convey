/**
 * @convey/shared
 * Shared contracts, types, enums, and models for Convey Communication Service
 */

// Channels supported across Convey
export enum Channel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WHATSAPP = 'WHATSAPP',
  SLACK = 'SLACK',
  CHAT = 'CHAT',
  TOOL = 'TOOL',
}

// Priority Tiers
export enum MessagePriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  DEFAULT = 'DEFAULT',
  LOW = 'LOW',
}

// Message Status Lifecycle
export enum MessageStatus {
  ACCEPTED = 'ACCEPTED',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SUPPRESSED = 'SUPPRESSED',
  REPLAYED = 'REPLAYED',
}

// Tenant Subscription & SLA Tiers
export enum TenantTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// Circuit Breaker State
export enum CircuitState {
  CLOSED = 'CLOSED',
  HALF_OPEN = 'HALF_OPEN',
  OPEN = 'OPEN',
}

// DLQ Failure Categories
export enum DlqFailureCategory {
  PROVIDER_5XX = 'PROVIDER_5XX',
  RATE_LIMIT_429 = 'RATE_LIMIT_429',
  INVALID_RECIPIENT_400 = 'INVALID_RECIPIENT_400',
  AUTH_EXPIRED_401 = 'AUTH_EXPIRED_401',
  TIMEOUT_504 = 'TIMEOUT_504',
  POLICY_REJECTED = 'POLICY_REJECTED',
  UNKNOWN = 'UNKNOWN',
}

// Suppression Reasons
export enum SuppressionReason {
  HARD_BOUNCE = 'HARD_BOUNCE',
  SPAM_COMPLAINT = 'SPAM_COMPLAINT',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  MANUAL_BLOCK = 'MANUAL_BLOCK',
}

// Distributed Trace Span Interface
export interface TraceSpan {
  id: string;
  name: string;
  serviceName: string;
  startTimeMs: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  attributes?: Record<string, string | number | boolean>;
}

// Message Summary DTO
export interface MessageSummaryDto {
  publicId: string;
  teamId: string;
  channel: Channel;
  recipient: string;
  priority: MessagePriority;
  status: MessageStatus;
  providerId?: string;
  latencyMs?: number;
  costUsd?: number;
  createdAt: string;
  deliveredAt?: string;
}

// Message Detailed DTO with Trace and Encryption info
export interface MessageDetailDto extends MessageSummaryDto {
  traceparent?: string;
  content: {
    subject?: string;
    body?: string;
    templateId?: string;
    variables?: Record<string, string | number | boolean | null>;
  };
  encryption?: {
    isEncrypted: boolean;
    algorithm: string;
    kmsKeyId?: string;
  };
  spans: TraceSpan[];
  attempts: Array<{
    attemptNumber: number;
    providerId: string;
    status: string;
    responseCode?: number;
    errorDetails?: string;
    latencyMs: number;
    attemptedAt: string;
  }>;
}

// Provider Health Status
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

// Real-Time System Telemetry
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
    postgresPool: { status: 'healthy' | 'degraded' | 'error'; activeConnections: number; idleConnections: number };
    redisCluster: { status: 'healthy' | 'degraded' | 'error'; usedMemoryMb: number; rttMs: number };
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

// DLQ Replay Request and Simulation Response
export interface DlqReplayRequest {
  dryRun?: boolean;
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

export interface DlqReplayResult {
  dryRun: boolean;
  matchedMessagesCount: number;
  replayedCount?: number;
  simulation?: {
    estimatedSuccessRatePercent: number;
    estimatedApiCostUsd: number;
    estimatedExecutionTimeSeconds: number;
    affectedTenantsCount: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

// Suppression Record
export interface SuppressionDto {
  id: string;
  teamId: string;
  recipient: string;
  channel: Channel;
  reason: SuppressionReason;
  metadata?: Record<string, string | number | boolean | null>;
  expiresAt?: string;
  createdAt: string;
}

// Policy Configuration DTO
export interface PolicyDto {
  id: string;
  teamId: string;
  name: string;
  type: 'RATE_LIMIT' | 'TOKEN_BUCKET' | 'QUIET_HOURS' | 'COST_OPTIMIZER' | 'TENANT_SLA';
  config: Record<string, string | number | boolean | null>;
  enabled: boolean;
  updatedAt: string;
}
