/**
 * @convey/sdk
 * Official zero-dependency Node.js, Bun, and Edge SDK for Convey communication service.
 */

// Main Client
export { Convey, ConveyClient } from './client';

// HTTP Engine & Pagination
export { HttpClient } from './http';
export { AutoPaginator, type PageFetcher, type PageResult } from './pagination';

// Resource Clients
export { MessagesResource } from './resources/messages';
export { BatchesResource } from './resources/batches';
export { SuppressionsResource } from './resources/suppressions';
export { WebhooksResource, WebhookSubscriptionsResource } from './resources/webhooks';
export { DlqResource } from './resources/dlq';
export { SandboxResource } from './resources/sandbox';
export { ReportsResource } from './resources/reports';
export { AdminResource, type AdminListMessagesQuery, type AdminListMessagesResponse } from './resources/admin';

// Errors
export {
  ConveyError,
  ConveyApiError,
  ConveyAuthenticationError,
  ConveyForbiddenError,
  ConveyNotFoundError,
  ConveyConflictError,
  ConveyRateLimitError,
  ConveyValidationError,
  ConveyTimeoutError,
  ConveyNetworkError,
  ConveySecurityError,
  type ConveyApiErrorOptions,
} from './errors';

// Cryptographic & Trace Utilities
export {
  computeHmacSha256Hex,
  constructWebhookEvent,
  parseWebhookSignatureHeader,
  timingSafeEqual,
  verifyWebhookSignature,
  type WebhookSignatureParts,
} from './utils/crypto';
export { generateTraceparent, createChildTraceparent } from './utils/trace';
export { generateUlid } from './utils/ulid';

// Types & DTOs
export type {
  Channel,
  MessagePriority,
  MessageStatus,
  CircuitState,
  SuppressionReason,
  DlqFailureCategory,
  UserRole,
  ConveyClientOptions,
  RequestOptions,
  MessageContent,
  SendMessageRequest,
  MessageAcceptedResponse,
  BulkSendMessageRequest,
  BulkMessageResponse,
  TraceSpan,
  MessageAttemptDto,
  MessageDetailDto,
  MessageTimelineResponse,
  MessageTraceResponse,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  CreateBatchRequest,
  BatchDto,
  CreateBatchResponse,
  ListBatchesResponse,
  BatchActionResponse,
  AddSuppressionRequest,
  BulkAddSuppressionsRequest,
  SuppressionDto,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  CreateWebhookSubscriptionRequest,
  WebhookSubscriptionDto,
  ListWebhookSubscriptionsResponse,
  ConveyWebhookEvent,
  ListDlqQuery,
  ListDlqResponse,
  DlqReplayRequest,
  DlqReplayResult,
  DlqMutatedReplayRequest,
  DlqMutatedReplayResult,
  ListSandboxMessagesResponse,
  ClearSandboxMessagesResponse,
  ReportingMetrics,
  ReportingQueryParams,
  ReportingOverviewResponse,
  TeamReportDto,
  TeamsReportResponse,
  CategoryReportDto,
  CategoriesReportResponse,
  CampaignReportDto,
  CampaignsReportResponse,
  CampaignDetailDto,
  LiveTelemetrySnapshot,
  ProviderHealthDto,
  RegisterProviderRequest,
  TestProviderConnectionRequest,
  TestProviderConnectionResult,
  AuditLogDto,
  ListAuditLogsQuery,
  ListAuditLogsResponse,
} from './types';

// Default export
import { Convey } from './client';
export default Convey;
