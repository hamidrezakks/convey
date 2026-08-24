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
// Resource Clients
export { MessagesResource } from './resources/messages';
export { ReportsResource } from './resources/reports';
export { SandboxResource } from './resources/sandbox';
export { SuppressionsResource } from './resources/suppressions';
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
  Channel,
  CircuitState,
  ClearSandboxMessagesResponse,
  ConveyClientOptions,
  ConveyWebhookEvent,
  CreateBatchRequest,
  CreateBatchResponse,
  CreateWebhookSubscriptionRequest,
  CreateWebhookSubscriptionResponse,
  DlqFailureCategory,
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
  MessagePriority,
  MessageStatus,
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
  SuppressionReason,
  TeamReportDto,
  TeamsReportResponse,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TestProviderConnectionRequest,
  TestProviderConnectionResult,
  TraceSpan,
  UserRole,
  WebhookSubscriptionDto,
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
