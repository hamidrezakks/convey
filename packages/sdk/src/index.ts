/**
 * @convey/sdk
 * Official zero-dependency Node.js, Bun, and Edge SDK for Convey communication service.
 */

// Fluent Builders
export {
  BatchBuilder,
  type BatchDispatchOptions,
  MessageBuilder,
} from './builder';
// Main Client
export { Convey, ConveyClient } from './client';
// Environments & URL Resolution
export {
  ConveyEnvironment,
  type ConveyEnvironmentName,
  normalizeBaseUrl,
  resolveBaseUrl,
  resolveEnvironmentUrl,
} from './environments';
// Errors
export {
  ConveyApiError,
  type ConveyApiErrorOptions,
  ConveyAuthenticationError,
  ConveyConfigurationError,
  ConveyConflictError,
  ConveyError,
  ConveyForbiddenError,
  ConveyNetworkError,
  ConveyNotFoundError,
  ConveyRateLimitError,
  ConveySecurityError,
  ConveyTimeoutError,
  ConveyValidationError,
} from './errors';
// HTTP Engine & Pagination
export { HttpClient } from './http';

// Logging & Telemetry
export {
  ConsoleLogger,
  type ConveyLogger,
  createLogger,
  type LogLevel,
  NoopLogger,
  sanitizeLogData,
} from './logger';

// Middleware & Interceptors
export {
  type ConveyMiddleware,
  type ErrorContext,
  MiddlewareRunner,
  type RequestContext,
  type ResponseContext,
} from './middleware';
export { AutoPaginator, type PageFetcher, type PageResult } from './pagination';
// Polling Helpers
export {
  type WaitForBatchOptions,
  type WaitForDeliveryOptions,
  waitForBatchCompletion,
  waitForDelivery,
} from './polling';
// Rate Limiting
export {
  type RateLimiterOptions,
  TokenBucketRateLimiter,
} from './rate-limiter';
export { type AdminListMessagesQuery, type AdminListMessagesResponse, AdminResource } from './resources/admin';
export { BatchesResource } from './resources/batches';
export { DlqResource } from './resources/dlq';
export { InboxResource } from './resources/inbox';
export { MessagesResource } from './resources/messages';
export { PreferencesResource } from './resources/preferences';
export { ReportsResource } from './resources/reports';
export { SandboxResource } from './resources/sandbox';
export { SuppressionsResource } from './resources/suppressions';
export { TemplatesResource } from './resources/templates';
export { WebhookSubscriptionsResource, WebhooksResource } from './resources/webhooks';
// Types & DTOs
export type {
  AddSuppressionRequest,
  AuditLogDto,
  BatchActionResponse,
  BatchDto,
  BulkAddSuppressionsRequest,
  BulkMessageResponse,
  BulkSendMessageRequest,
  CampaignDetailDto,
  CampaignReportDto,
  CampaignsReportResponse,
  CategoriesReportResponse,
  CategoryReportDto,
  ClearSandboxMessagesResponse,
  ConveyClientOptions,
  ConveyWebhookEvent,
  CreateBatchRequest,
  CreateBatchResponse,
  CreateWebhookSubscriptionRequest,
  CreateWebhookSubscriptionResponse,
  DlqMutatedReplayRequest,
  DlqMutatedReplayResult,
  DlqReplayRequest,
  DlqReplayResult,
  ListAuditLogsQuery,
  ListAuditLogsResponse,
  ListBatchesResponse,
  ListDlqQuery,
  ListDlqResponse,
  ListSandboxMessagesResponse,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  ListWebhookSubscriptionsResponse,
  LiveTelemetrySnapshot,
  MessageAcceptedResponse,
  MessageAttemptDto,
  MessageContent,
  MessageDetailDto,
  MessageTimelineResponse,
  MessageTraceResponse,
  ProviderHealthDto,
  RegisterProviderRequest,
  ReportingMetrics,
  ReportingOverviewResponse,
  ReportingQueryParams,
  RequestOptions,
  RetryPolicy,
  SendMessageRequest,
  SuppressionDto,
  TeamReportDto,
  TeamsReportResponse,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TestProviderConnectionRequest,
  TestProviderConnectionResult,
  TraceSpan,
  WebhookSubscriptionDto,
} from './types';
// Enums
export {
  BatchState,
  Channel,
  CircuitState,
  DlqFailureCategory,
  MessagePriority,
  MessageStatus,
  SuppressionReason,
  UserRole,
} from './types';
// Cryptographic & Trace Utilities
export {
  computeHmacSha256Hex,
  constructWebhookEvent,
  generateTestSignature,
  parseWebhookSignatureHeader,
  timingSafeEqual,
  verifyWebhookSignature,
  type WebhookSignatureParts,
} from './utils/crypto';
export { createChildTraceparent, generateTraceparent } from './utils/trace';
export { generateUlid } from './utils/ulid';
// Webhook Framework Adapters & Test Fixtures
export {
  createWebhookHandler,
  type GenerateTestEventOptions,
  generateTestWebhookEvent,
  type WebhookEventHandler,
  type WebhookEventHandlerMap,
  type WebhookHandler,
  type WebhookHandlerConfig,
} from './webhooks-handler';

// Default export
import { Convey } from './client';
export default Convey;
