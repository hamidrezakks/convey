/**
 * @convey/shared
 * Shared contracts, types, enums, and models for Convey Communication Service
 */

import type { Channel } from './channels';

// Channels supported across Convey
export * from './channels';

// ISO-4217 Currency Standards & Formatting
export * from './currencies';

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
  isSandbox?: boolean;
  providerId?: string;
  latencyMs?: number;
  costUsd?: number;
  createdAt: string;
  deliveredAt?: string;
}

// Message Detailed DTO with Trace and Encryption info
export interface MessageDetailDto extends MessageSummaryDto {
  traceparent?: string;
  isSandbox?: boolean;
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
  baseCurrency?: string;
  unitCostNative?: number;
  formattedUnitCost?: string;
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

export interface AdminAuditLedgerDto {
  id: string;
  actor: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress: string;
  sha256Hash: string;
}

// Provider Catalog & Configuration Interfaces
export interface ProviderEnvVarSpec {
  key: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

export interface ProviderCatalogItem {
  id: string;
  displayName: string;
  channel: Channel;
  description: string;
  websiteUrl?: string;
  docsUrl?: string;
  requiredEnvVars: ProviderEnvVarSpec[];
  defaultPriority: number;
  defaultWeight: number;
  defaultBaseCurrency?: string;
  defaultUnitCost?: number;
}

export interface ProviderFeatureConfigs {
  // WhatsApp Cost Saving & Interactive Features
  whatsapp?: {
    costSaving24hSession?: boolean; // Converts template to free session plain text within 24h
    autoTemplateValidation?: boolean;
    interactiveButtons?: boolean;
    webhookVerifyToken?: string;
  };
  // Email Deliverability & Tracking
  email?: {
    openTracking?: boolean;
    clickTracking?: boolean;
    tlsPolicy?: 'REQUIRE' | 'OPPORTUNISTIC';
    sandboxMode?: boolean;
    customHeaders?: Record<string, string>;
    dkimSelector?: string;
    ipPoolName?: string;
  };
  // SMS Carrier Optimization
  sms?: {
    smartGsmPacking?: boolean; // Strip invisible unicode to avoid segment double billing
    dlrTimeoutSeconds?: number;
    alphanumericSenderId?: boolean;
    shortUrlTracking?: boolean;
  };
  // Push Notification Protocol
  push?: {
    timeToLiveSeconds?: number;
    collapseKey?: string;
    apnsPushType?: 'alert' | 'background';
    fcmHighPriority?: boolean;
    sound?: string;
    badgeIncrement?: boolean;
  };
  // Slack & Chat
  slack?: {
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
    threadBroadcast?: boolean;
    mrkdwn?: boolean;
  };
  // Webhook & Tool
  tool?: {
    hmacSignatureHeader?: string;
    retryCount?: number;
    timeoutMs?: number;
    mutualTlsEnabled?: boolean;
  };
  custom?: Record<string, unknown>;
}

export interface ConfiguredProviderDto {
  id: string;
  providerId: string;
  displayName: string;
  channel: Channel;
  isPrimary: boolean;
  priority: number;
  weight: number;
  fallbackProviderId?: string;
  baseCurrency?: string;
  unitCost?: number;
  formattedUnitCost?: string;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  credentialsMasked: Record<string, string>;
  config?: ProviderFeatureConfigs;
  envSnippet: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterProviderRequest {
  providerId: string;
  channel: Channel;
  credentials: Record<string, string>;
  baseCurrency?: string;
  unitCost?: number;
  config?: ProviderFeatureConfigs;
  isPrimary?: boolean;
  priority?: number;
  weight?: number;
  fallbackProviderId?: string;
  teamId?: string;
}

export interface TestConnectionRequest {
  providerId: string;
  credentials: Record<string, string>;
}

export interface TestConnectionResult {
  success: boolean;
  providerId: string;
  latencyMs: number;
  message: string;
  testedAt: string;
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
  type: 'RATE_LIMIT' | 'TOKEN_BUCKET' | 'QUIET_HOURS' | 'COST_OPTIMIZER' | 'TENANT_SLA' | 'BUDGET';
  config: Record<string, string | number | boolean | null>;
  currency?: string;
  enabled: boolean;
  updatedAt: string;
}

export interface BudgetPolicyDto {
  id: string;
  teamId: string;
  monthlyBudget: number;
  currency: string;
  usedAmount: number;
  remainingAmount: number;
  currencySymbol: string;
  hardStop: boolean;
  updatedAt: string;
}

// Environment Types
export type EnvironmentType = 'production' | 'staging' | 'sandbox';

export interface WorkspaceEnvironment {
  id: string;
  name: string;
  region: string;
  tier: string;
  type: EnvironmentType;
  status: 'active' | 'degraded' | 'maintenance';
}

// Audit Log Ledger DTO
export interface AuditLogDto {
  id: string;
  tenantId: string;
  team: string;
  actor: string;
  actorRole: string;
  action: string;
  target: string;
  ipAddress?: string;
  sha256Hash: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Webhook Subscription DTO
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

// Complete 88 Turnkey Provider Catalog
export * from './provider-catalog';
