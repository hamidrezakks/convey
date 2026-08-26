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

// Transport Layer Proxy Types
export type ProxyType = 'http' | 'https' | 'socks5' | 'socks5h';

export interface ProviderProxyAuth {
  username?: string;
  password?: string;
}

export interface ProviderProxyTls {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
  servername?: string;
}

export interface ProviderProxyConfig {
  enabled: boolean;
  type: ProxyType;
  host: string;
  port: number;
  protocol?: 'http:' | 'https:' | 'socks5:' | 'socks5h:';
  auth?: ProviderProxyAuth;
  headers?: Record<string, string>;
  tls?: ProviderProxyTls;
  timeoutMs?: number;
  noProxy?: string[];
  rawUrl?: string;
}

export interface ProxyDiagnosticResult {
  success: boolean;
  proxyType: ProxyType;
  proxyHost: string;
  proxyPort: number;
  resolvedIp?: string;
  dnsResolution?: string;
  dnsLatencyMs?: number;
  handshakeLatencyMs: number;
  tlsLatencyMs?: number;
  e2eLatencyMs: number;
  statusCode?: number;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface ProviderFeatureConfigs {
  // Transport Layer Outbound Proxy
  proxy?: ProviderProxyConfig;
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
  config?: ProviderFeatureConfigs;
}

export interface TestConnectionResult {
  success: boolean;
  providerId: string;
  latencyMs: number;
  message: string;
  testedAt: string;
  diagnostics?: ProxyDiagnosticResult;
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

// --- Multi-Dimension Reporting & Analytics DTOs ---

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
  topChannel: Channel | string;
  channelBreakdown?: Array<{
    channel: Channel;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
    costUsd: number;
  }>;
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

export interface CampaignFunnel {
  accepted: number;
  dispatched: number;
  delivered: number;
  opened: number;
  read: number;
  failed: number;
  deliveryRatePercent?: number;
  openRatePercent?: number;
  readRatePercent?: number;
}

export interface CampaignDetailDto extends CampaignReportDto {
  funnel: CampaignFunnel;
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

export interface ReportingSummaryDto {
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
}

export interface ChannelReportingMetric {
  channel: Channel;
  sent?: number;
  delivered?: number;
  opened?: number;
  read?: number;
  failed?: number;
  costUsd?: number;
  deliveryRate?: number;
  metrics?: ReportingMetrics;
  costPerDeliveredUsd?: number;
}

export interface ReportingTimeSeriesDataPoint {
  timestamp: string;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
  costUsd: number;
}

export interface ReportingOverviewResponse {
  summary: ReportingSummaryDto;
  channelBreakdown: ChannelReportingMetric[];
  timeSeries: ReportingTimeSeriesDataPoint[];
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

export interface TeamsReportResponse {
  teams: TeamReportDto[];
  total?: number;
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

export interface CategoriesReportResponse {
  categories: CategoryReportDto[];
  total?: number;
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

export interface CampaignsReportResponse {
  campaigns: CampaignReportDto[];
  total?: number;
  page?: number;
  limit?: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore?: boolean;
  };
  timeframe?: {
    startDate: string;
    endDate: string;
  };
}

// Complete 88 Turnkey Provider Catalog
export * from './provider-catalog';

// --- Template Lifecycle DTOs ---
export type TemplateCategory = 'transactional' | 'marketing' | 'alert';
export type TemplateVersionStatus = 'draft' | 'published' | 'archived';

// ==========================================
// Rich WhatsApp Component Contracts
// ==========================================

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

// ==========================================
// Rich Push Notification Component Contracts (APNs, FCM, WebPush)
// ==========================================

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

export interface TemplateChannelConfig {
  email?: {
    subject: string;
    html?: string;
    text?: string;
    mjml?: string;
  };
  sms?: {
    body: string;
  };
  push?: PushChannelConfig;
  chat?: {
    body: string;
  };
  whatsapp?: WhatsAppChannelConfig;
}

export interface TemplateVersionDto {
  id: string;
  templateId: string;
  version: string;
  status: TemplateVersionStatus;
  schema: Record<string, unknown>;
  channels: TemplateChannelConfig;
  translations: Record<string, Partial<TemplateChannelConfig>>;
  changeSummary?: string;
  author: string;
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
  description?: string;
  category: TemplateCategory;
  defaultLocale: string;
  publishedVersionId?: string;
  publishedVersion?: TemplateVersionDto;
  versionsCount?: number;
  createdAt: string;
  updatedAt: string;
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

export interface CreateTemplateRequest {
  slug: string;
  name: string;
  description?: string;
  category?: TemplateCategory;
  defaultLocale?: string;
  initialVersion?: {
    version: string;
    channels: TemplateChannelConfig;
    schema?: Record<string, unknown>;
    translations?: Record<string, Partial<TemplateChannelConfig>>;
    changeSummary?: string;
  };
}

export interface CreateTemplateVersionRequest {
  version: string;
  channels: TemplateChannelConfig;
  schema?: Record<string, unknown>;
  translations?: Record<string, Partial<TemplateChannelConfig>>;
  changeSummary?: string;
  publishImmediately?: boolean;
}

export interface RenderTemplateRequest {
  templateSlug?: string;
  version?: string;
  templateSpec?: TemplateChannelConfig;
  channel: Channel;
  variables?: Record<string, unknown>;
  locale?: string;
  recipient?: {
    email?: string;
    phone?: string;
    [key: string]: unknown;
  };
}

export interface RenderTemplateResponse {
  channel: Channel;
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
  renderedWhatsApp?: WhatsAppChannelConfig;
  renderedPush?: PushChannelConfig;
  localeUsed: string;
  missingVariables?: string[];
  resolvedPartials?: string[];
}

// --- Enterprise Governance & RBAC DTOs ---
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  CONTENT = 'content',
  AUDITOR = 'auditor',
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface EnvironmentDto {
  id: string;
  projectId: string;
  name: string;
  type: EnvironmentType;
  apiKeyPrefix: string;
  createdAt: string;
}

// --- FinOps Least-Cost Carrier & Geo-Routing DTOs ---
export interface CarrierRateCardDto {
  countryCode: string; // e.g. "+44", "+1", "+49"
  countryName: string;
  channel: Channel;
  providerId: string;
  unitCostUsd: number;
  qualityScore: number; // 0.0 - 1.0 (based on SLA and delivery rates)
}

export interface CarrierCostEvaluationResult {
  countryCode: string;
  selectedProviderId: string;
  estimatedCostUsd: number;
  projectedSavingsUsd: number;
  cheapestAlternativeProviderId?: string;
  fallbackCascade: string[];
}

// --- Commercial Quota DTOs ---
export interface TenantQuotaDto {
  tenantId: string;
  plan: 'community' | 'pro' | 'enterprise';
  monthlyQuota: number;
  usedThisMonth: number;
  remainingThisMonth: number;
  quotaPercentUsed: number;
  isExceeded: boolean;
  renewsAt: string;
}

// --- Recipient Preferences & Consent DTOs (Plugin Contract) ---
export interface SubscriptionTopicDto {
  id: string;
  tenantId: string;
  team: string;
  key: string;
  name: string;
  description?: string;
  isMandatory: boolean;
  defaultChannels: Channel[];
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
  channelPreferences: Record<Channel, boolean>;
  topicPreferences: Record<string, boolean>;
  unsubscribeToken: string;
  updatedAt: string;
}

export interface PreferenceCheckResult {
  allowed: boolean;
  reason?: 'OPTED_OUT_TOPIC' | 'DISABLED_CHANNEL' | 'IN_QUIET_HOURS' | 'SUPPRESSED';
  deferUntil?: string; // If in quiet hours, next allowed delivery window
}

// --- In-App Notification Feed DTOs (Plugin Contract) ---
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
