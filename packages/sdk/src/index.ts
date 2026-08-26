/**
 * @convey/sdk
 * Official zero-dependency Node.js, Bun, and Edge SDK for Convey communication service.
 */

// Main Client
export { Convey, ConveyClient } from './client';
// Errors
export {
  ConveyApiError,
  type ConveyApiErrorOptions,
  ConveyAuthenticationError,
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
export { AutoPaginator, type PageFetcher, type PageResult } from './pagination';
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
  parseWebhookSignatureHeader,
  timingSafeEqual,
  verifyWebhookSignature,
  type WebhookSignatureParts,
} from './utils/crypto';
export { createChildTraceparent, generateTraceparent } from './utils/trace';
export { generateUlid } from './utils/ulid';

// Default export
import { Convey } from './client';
export default Convey;
