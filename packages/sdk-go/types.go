package convey

import "time"

// Channel defines communication channels supported by Convey.
type Channel string

const (
	ChannelEmail    Channel = "EMAIL"
	ChannelSMS      Channel = "SMS"
	ChannelWhatsApp Channel = "WHATSAPP"
	ChannelPush     Channel = "PUSH"
	ChannelSlack    Channel = "SLACK"
	ChannelTool     Channel = "TOOL"
	ChannelVoice    Channel = "VOICE"
	ChannelInApp    Channel = "IN_APP"
	ChannelDiscord  Channel = "DISCORD"
	ChannelTelegram Channel = "TELEGRAM"
	ChannelWebhook  Channel = "WEBHOOK"
)

// MessagePriority defines queue delivery priority levels.
type MessagePriority string

const (
	PriorityCritical MessagePriority = "CRITICAL"
	PriorityHigh     MessagePriority = "HIGH"
	PriorityDefault  MessagePriority = "DEFAULT"
	PriorityLow      MessagePriority = "LOW"
)

// MessageStatus defines lifecycle states of a message.
type MessageStatus string

const (
	StatusAccepted   MessageStatus = "ACCEPTED"
	StatusQueued     MessageStatus = "QUEUED"
	StatusSending    MessageStatus = "SENDING"
	StatusDelivered  MessageStatus = "DELIVERED"
	StatusFailed     MessageStatus = "FAILED"
	StatusSuppressed MessageStatus = "SUPPRESSED"
	StatusReplayed   MessageStatus = "REPLAYED"
)

// CircuitState represents provider circuit breaker condition.
type CircuitState string

const (
	CircuitStateClosed   CircuitState = "CLOSED"
	CircuitStateHalfOpen CircuitState = "HALF_OPEN"
	CircuitStateOpen     CircuitState = "OPEN"
)

// SuppressionReason defines reasons for recipient suppression.
type SuppressionReason string

const (
	SuppressionHardBounce     SuppressionReason = "HARD_BOUNCE"
	SuppressionSpamComplaint SuppressionReason = "SPAM_COMPLAINT"
	SuppressionUnsubscribe   SuppressionReason = "UNSUBSCRIBE"
	SuppressionManualBlock   SuppressionReason = "MANUAL_BLOCK"
)

// DlqFailureCategory categorizes dead-letter queue failures.
type DlqFailureCategory string

const (
	DlqFailureProvider5xx         DlqFailureCategory = "PROVIDER_5XX"
	DlqFailureRateLimit429        DlqFailureCategory = "RATE_LIMIT_429"
	DlqFailureInvalidRecipient400 DlqFailureCategory = "INVALID_RECIPIENT_400"
	DlqFailureAuthExpired401      DlqFailureCategory = "AUTH_EXPIRED_401"
	DlqFailureTimeout504          DlqFailureCategory = "TIMEOUT_504"
	DlqFailurePolicyRejected      DlqFailureCategory = "POLICY_REJECTED"
	DlqFailureUnknown             DlqFailureCategory = "UNKNOWN"
)

// UserRole defines access control roles.
type UserRole string

const (
	RoleOrgAdmin  UserRole = "ORG_ADMIN"
	RoleTeamAdmin UserRole = "TEAM_ADMIN"
	RoleDeveloper UserRole = "DEVELOPER"
	RoleViewer    UserRole = "VIEWER"
)

// BatchState represents campaign batch processing lifecycle states.
type BatchState string

const (
	BatchStateInitializing BatchState = "INITIALIZING"
	BatchStateProcessing   BatchState = "PROCESSING"
	BatchStatePaused       BatchState = "PAUSED"
	BatchStateCompleted    BatchState = "COMPLETED"
	BatchStateCancelled    BatchState = "CANCELLED"
)

// MessageContent holds message payload details.
type MessageContent struct {
	Subject    string                 `json:"subject,omitempty"`
	Body       string                 `json:"body,omitempty"`
	Text       string                 `json:"text,omitempty"`
	HTML       string                 `json:"html,omitempty"`
	TemplateID string                 `json:"templateId,omitempty"`
	Variables  map[string]interface{} `json:"variables,omitempty"`
}

// SendMessageRequest is an ergonomic request for dispatching a message.
type SendMessageRequest struct {
	Channel        Channel                `json:"channel,omitempty"`
	Recipient      string                 `json:"recipient,omitempty"`
	Recipients     map[string]interface{} `json:"recipients,omitempty"`
	Channels       []interface{}          `json:"channels,omitempty"`
	Content        *MessageContent        `json:"content,omitempty"`
	Template       string                 `json:"template,omitempty"`
	Variables      map[string]interface{} `json:"variables,omitempty"`
	Priority       MessagePriority        `json:"priority,omitempty"`
	Category       string                 `json:"category,omitempty"`
	Country        string                 `json:"country,omitempty"`
	Team           string                 `json:"team,omitempty"`
	UserID         string                 `json:"userId,omitempty"`
	IdempotencyKey string                 `json:"idempotencyKey,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Fallback       interface{}            `json:"fallback,omitempty"`
	Cascade        interface{}            `json:"cascade,omitempty"`
	ScheduledAt    *time.Time             `json:"scheduledAt,omitempty"`
}

// MessageAcceptedResponse is returned upon synchronous message acceptance.
type MessageAcceptedResponse struct {
	MessageID      string        `json:"messageId"`
	PublicID       string        `json:"publicId"`
	State          string        `json:"state"`
	Status         MessageStatus `json:"status"`
	CreatedAt      string        `json:"createdAt"`
	AcceptedAt     string        `json:"acceptedAt"`
	ScheduledAt    *string       `json:"scheduledAt,omitempty"`
	Success        bool          `json:"success"`
	IsSandbox      bool          `json:"isSandbox"`
	IdempotencyKey *string       `json:"idempotencyKey,omitempty"`
}

// BulkMessageResponse represents the outcome of a bulk message ingestion.
type BulkMessageResponse struct {
	Total int                       `json:"total"`
	Items []MessageAcceptedResponse `json:"items"`
}

// MessageAttemptDto represents an execution attempt for a message.
type MessageAttemptDto struct {
	ID         string                 `json:"id"`
	Provider   string                 `json:"provider"`
	Channel    string                 `json:"channel"`
	Status     string                 `json:"status"`
	LatencyMs  int                    `json:"latencyMs"`
	Error      *string                `json:"error,omitempty"`
	AttemptNum int                    `json:"attemptNum"`
	CreatedAt  string                 `json:"createdAt"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// MessageDetailDto contains detailed message tracking data.
type MessageDetailDto struct {
	PublicID    string                 `json:"publicId"`
	Team        string                 `json:"team"`
	Channel     string                 `json:"channel"`
	Recipient   string                 `json:"recipient"`
	Status      MessageStatus          `json:"status"`
	Priority    string                 `json:"priority"`
	CostUSD     float64                `json:"costUsd"`
	Attempts    []MessageAttemptDto    `json:"attempts,omitempty"`
	CreatedAt   string                 `json:"createdAt"`
	DeliveredAt *string                `json:"deliveredAt,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// MessageTimelineResponse is the chronological event sequence for a message.
type MessageTimelineResponse struct {
	MessageID string              `json:"messageId"`
	Timeline  []map[string]interface{} `json:"timeline"`
}

// TraceSpan represents a single W3C distributed trace span.
type TraceSpan struct {
	Name       string                 `json:"name"`
	DurationMs float64                `json:"durationMs"`
	Timestamp  string                 `json:"timestamp"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
}

// MessageTraceResponse represents distributed trace waterfall for a message.
type MessageTraceResponse struct {
	MessageID       string      `json:"messageId"`
	Traceparent     string      `json:"traceparent"`
	TotalDurationMs float64     `json:"totalDurationMs"`
	Spans           []TraceSpan `json:"spans"`
}

// TemplatePreviewRequest is parameters for previewing template rendering.
type TemplatePreviewRequest struct {
	Template  interface{}            `json:"template"`
	Variables map[string]interface{} `json:"variables,omitempty"`
	Recipient interface{}            `json:"recipient,omitempty"`
}

// TemplatePreviewResponse holds rendered template output.
type TemplatePreviewResponse struct {
	Subject          string   `json:"subject,omitempty"`
	Body             string   `json:"body,omitempty"`
	Text             string   `json:"text,omitempty"`
	HTML             string   `json:"html,omitempty"`
	Rendered         string   `json:"rendered"`
	MissingVariables []string `json:"missingVariables,omitempty"`
}

// BatchDto represents campaign batch container metadata.
type BatchDto struct {
	ID             string     `json:"id"`
	Team           string     `json:"team"`
	State          BatchState `json:"state"`
	TotalCount     int        `json:"totalCount"`
	ProcessedCount int        `json:"processedCount"`
	SuccessCount   int        `json:"successCount"`
	FailedCount    int        `json:"failedCount"`
	CreatedAt      string     `json:"createdAt"`
	CompletedAt    *string    `json:"completedAt,omitempty"`
}

// CreateBatchRequest parameters for creating a new batch.
type CreateBatchRequest struct {
	Team        string                 `json:"team,omitempty"`
	Name        string                 `json:"name"`
	Category    string                 `json:"category,omitempty"`
	Priority    MessagePriority        `json:"priority,omitempty"`
	Messages    []SendMessageRequest   `json:"messages"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	ScheduledAt *time.Time             `json:"scheduledAt,omitempty"`
}

// CreateBatchResponse is returned upon batch creation.
type CreateBatchResponse struct {
	Success bool     `json:"success"`
	Batch   BatchDto `json:"batch"`
}

// ListBatchesResponse is list of batches for a team.
type ListBatchesResponse struct {
	Success bool       `json:"success"`
	Batches []BatchDto `json:"batches"`
}

// BatchActionResponse represents the outcome of a batch lifecycle transition.
type BatchActionResponse struct {
	Success bool       `json:"success"`
	BatchID string     `json:"batchId"`
	State   BatchState `json:"state"`
	Message string     `json:"message,omitempty"`
}

// SuppressionDto represents a suppressed recipient rule.
type SuppressionDto struct {
	ID        string            `json:"id"`
	Team      string            `json:"team"`
	Recipient string            `json:"recipient"`
	Channel   Channel           `json:"channel"`
	Reason    SuppressionReason `json:"reason"`
	Category  *string           `json:"category,omitempty"`
	CreatedAt string            `json:"createdAt"`
}

// AddSuppressionRequest parameters to suppress a recipient.
type AddSuppressionRequest struct {
	Identifier string            `json:"identifier,omitempty"`
	Recipient  string            `json:"recipient,omitempty"`
	Channel    Channel           `json:"channel,omitempty"`
	Reason     SuppressionReason `json:"reason,omitempty"`
	Category   string            `json:"category,omitempty"`
	Country    string            `json:"country,omitempty"`
	Team       string            `json:"team,omitempty"`
}

// ListSuppressionsQuery query parameters for listing suppressions.
type ListSuppressionsQuery struct {
	Limit    int               `json:"limit,omitempty"`
	Offset   int               `json:"offset,omitempty"`
	Channel  Channel           `json:"channel,omitempty"`
	Reason   SuppressionReason `json:"reason,omitempty"`
	Category string            `json:"category,omitempty"`
	Search   string            `json:"search,omitempty"`
}

// ListSuppressionsResponse list of suppression records with pagination.
type ListSuppressionsResponse struct {
	Items  []SuppressionDto `json:"items"`
	Total  int              `json:"total"`
	Limit  int              `json:"limit"`
	Offset int              `json:"offset"`
}

// WebhookSubscriptionDto represents a registered webhook endpoint.
type WebhookSubscriptionDto struct {
	ID          string   `json:"id"`
	Team        string   `json:"team"`
	URL         string   `json:"url"`
	Events      []string `json:"events"`
	Secret      string   `json:"secret"`
	IsActive    bool     `json:"isActive"`
	CreatedAt   string   `json:"createdAt"`
	Description *string  `json:"description,omitempty"`
}

// CreateWebhookSubscriptionRequest parameters to register a webhook subscription.
type CreateWebhookSubscriptionRequest struct {
	URL         string   `json:"url"`
	Events      []string `json:"events"`
	Secret      string   `json:"secret,omitempty"`
	Description string   `json:"description,omitempty"`
	Team        string   `json:"team,omitempty"`
}

// CreateWebhookSubscriptionResponse response after creating a webhook subscription.
type CreateWebhookSubscriptionResponse struct {
	Success      bool                   `json:"success"`
	Subscription WebhookSubscriptionDto `json:"subscription"`
}

// ListWebhookSubscriptionsResponse list of webhook subscriptions.
type ListWebhookSubscriptionsResponse struct {
	Success       bool                     `json:"success"`
	Subscriptions []WebhookSubscriptionDto `json:"subscriptions"`
}

// ConveyWebhookEvent represents an incoming verified webhook delivery event.
type ConveyWebhookEvent[T any] struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Timestamp int64     `json:"timestamp"`
	Data      T         `json:"data"`
	Team      string    `json:"team,omitempty"`
	Signature string    `json:"signature,omitempty"`
}

// ListDlqQuery parameters for querying dead-letter queue records.
type ListDlqQuery struct {
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
	Team   string `json:"team,omitempty"`
}

// ListDlqResponse list of messages in Dead-Letter Queue.
type ListDlqResponse struct {
	Items  []MessageDetailDto `json:"items"`
	Total  int                `json:"total"`
	Limit  int                `json:"limit"`
	Offset int                `json:"offset"`
}

// DlqReplayRequest parameters for replaying failed messages.
type DlqReplayRequest struct {
	MessageIDs []string `json:"messageIds"`
	Team       string   `json:"team,omitempty"`
}

// DlqReplayResult outcome of DLQ replay operation.
type DlqReplayResult struct {
	Success   bool     `json:"success"`
	Replayed  int      `json:"replayed"`
	Failed    int      `json:"failed"`
	FailedIDs []string `json:"failedIds,omitempty"`
}

// DlqMutatedReplayRequest parameters for dry-run simulation or mutated replay.
type DlqMutatedReplayRequest struct {
	MessageIDs  []string               `json:"messageIds"`
	DryRun      bool                   `json:"dryRun"`
	Override    map[string]interface{} `json:"override,omitempty"`
	Concurrency int                    `json:"concurrency,omitempty"`
}

// DlqMutatedReplayResult outcome of dry-run simulation or mutated replay.
type DlqMutatedReplayResult struct {
	Success         bool                   `json:"success"`
	DryRun          bool                   `json:"dryRun"`
	SimulatedCount  int                    `json:"simulatedCount"`
	EstimatedCost   float64                `json:"estimatedCostUsd"`
	ReplayedCount   int                    `json:"replayedCount"`
	ExecutionReport map[string]interface{} `json:"executionReport,omitempty"`
}

// ListSandboxMessagesResponse list of simulated messages in sandbox environment.
type ListSandboxMessagesResponse struct {
	Success  bool                     `json:"success"`
	Messages []map[string]interface{} `json:"messages"`
}

// ClearSandboxMessagesResponse outcome of resetting sandbox messages.
type ClearSandboxMessagesResponse struct {
	Success bool `json:"success"`
	Cleared int  `json:"cleared"`
}

// ReportingQueryParams parameters for analytics queries.
type ReportingQueryParams struct {
	StartDate string  `json:"startDate,omitempty"`
	EndDate   string  `json:"endDate,omitempty"`
	TeamID    string  `json:"teamId,omitempty"`
	Category  string  `json:"category,omitempty"`
	Channel   Channel `json:"channel,omitempty"`
	IsSandbox *bool   `json:"isSandbox,omitempty"`
	Limit     int     `json:"limit,omitempty"`
	Offset    int     `json:"offset,omitempty"`
}

// ReportingOverviewResponse aggregated delivery metrics overview.
type ReportingOverviewResponse struct {
	Success bool                   `json:"success"`
	Metrics map[string]interface{} `json:"metrics"`
}

// TeamsReportResponse metrics partitioned across tenant teams.
type TeamsReportResponse struct {
	Success bool                     `json:"success"`
	Teams   []map[string]interface{} `json:"teams"`
}

// CategoriesReportResponse metrics partitioned across message categories.
type CategoriesReportResponse struct {
	Success    bool                     `json:"success"`
	Categories []map[string]interface{} `json:"categories"`
}

// CampaignsReportResponse metrics partitioned across campaigns.
type CampaignsReportResponse struct {
	Success   bool                     `json:"success"`
	Campaigns []map[string]interface{} `json:"campaigns"`
}

// CampaignDetailDto detailed funnel analysis for a campaign.
type CampaignDetailDto struct {
	Success  bool                   `json:"success"`
	Campaign map[string]interface{} `json:"campaign"`
}

// TemplateDto represents a communication template.
type TemplateDto struct {
	ID          string                 `json:"id"`
	Slug        string                 `json:"slug"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Category    string                 `json:"category"`
	Environment string                 `json:"environment"`
	CreatedAt   string                 `json:"createdAt"`
	UpdatedAt   string                 `json:"updatedAt"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// TemplateVersionDto represents a version of a template.
type TemplateVersionDto struct {
	ID        string                 `json:"id"`
	Version   string                 `json:"version"`
	Subject   string                 `json:"subject,omitempty"`
	Body      string                 `json:"body"`
	IsActive  bool                   `json:"isActive"`
	CreatedAt string                 `json:"createdAt"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// CreateTemplateRequest parameters to create a new template.
type CreateTemplateRequest struct {
	Slug        string                 `json:"slug"`
	Name        string                 `json:"name"`
	Category    string                 `json:"category,omitempty"`
	Description string                 `json:"description,omitempty"`
	Subject     string                 `json:"subject,omitempty"`
	Body        string                 `json:"body"`
	Environment string                 `json:"environment,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CreateTemplateVersionRequest parameters to create a draft template version.
type CreateTemplateVersionRequest struct {
	Version  string                 `json:"version"`
	Subject  string                 `json:"subject,omitempty"`
	Body     string                 `json:"body"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// RenderTemplateRequest parameters for rendering a template.
type RenderTemplateRequest struct {
	Slug      string                 `json:"slug"`
	Version   string                 `json:"version,omitempty"`
	Variables map[string]interface{} `json:"variables,omitempty"`
	Locale    string                 `json:"locale,omitempty"`
}

// RenderTemplateResponse rendered template output.
type RenderTemplateResponse struct {
	Subject string `json:"subject,omitempty"`
	Body    string `json:"body"`
	Text    string `json:"text,omitempty"`
	HTML    string `json:"html,omitempty"`
}

// TemplatePartialDto represents a reusable template partial component.
type TemplatePartialDto struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

// SubscriptionTopicDto represents a notification preference topic.
type SubscriptionTopicDto struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	IsMandatory bool   `json:"isMandatory"`
}

// RecipientPreferencesDto represents channel and topic preferences for a recipient.
type RecipientPreferencesDto struct {
	RecipientID string                 `json:"recipientId"`
	Channels    map[string]bool        `json:"channels"`
	Topics      map[string]bool        `json:"topics"`
	QuietHours  map[string]interface{} `json:"quietHours,omitempty"`
}

// PreferenceCheckResult result of checking dispatch consent.
type PreferenceCheckResult struct {
	Allowed bool    `json:"allowed"`
	Reason  *string `json:"reason,omitempty"`
}

// InAppNotificationDto represents an in-app inbox notification.
type InAppNotificationDto struct {
	ID          string                 `json:"id"`
	RecipientID string                 `json:"recipientId"`
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	CtaURL      *string                `json:"ctaUrl,omitempty"`
	IconURL     *string                `json:"iconUrl,omitempty"`
	IsRead      bool                   `json:"isRead"`
	IsArchived  bool                   `json:"isArchived"`
	CreatedAt   string                 `json:"createdAt"`
	Data        map[string]interface{} `json:"data,omitempty"`
}

// InAppFeedResponse in-app notification feed.
type InAppFeedResponse struct {
	Notifications []InAppNotificationDto `json:"notifications"`
	UnreadCount   int                    `json:"unreadCount"`
	Total         int                    `json:"total"`
}

// LiveTelemetrySnapshot real-time system telemetry.
type LiveTelemetrySnapshot struct {
	Timestamp        string                 `json:"timestamp"`
	ThroughputRps    float64                `json:"throughputRps"`
	Latency          map[string]interface{} `json:"latency,omitempty"`
	Queues           map[string]interface{} `json:"queues,omitempty"`
	RuntimeGuard     map[string]interface{} `json:"runtimeGuard,omitempty"`
	Subsystems       map[string]interface{} `json:"subsystems,omitempty"`
	RecentActivity   []interface{}          `json:"recentActivity,omitempty"`
	HeapSaturation   float64                `json:"heapSaturation,omitempty"`
	QueueDepths      map[string]int         `json:"queueDepths,omitempty"`
	ActiveWorkers    int                    `json:"activeWorkers,omitempty"`
	P95LatencyMs     float64                `json:"p95LatencyMs,omitempty"`
	CircuitBreakers  map[string]string      `json:"circuitBreakers,omitempty"`
	SystemHealth     string                 `json:"systemHealth,omitempty"`
	ExtraDiagnostics map[string]interface{} `json:"extraDiagnostics,omitempty"`
}

// ProviderHealthDto health and performance state of a provider.
type ProviderHealthDto struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Channel      Channel      `json:"channel"`
	CircuitState CircuitState `json:"circuitState"`
	SuccessRate  float64      `json:"successRate"`
	P95LatencyMs float64      `json:"p95LatencyMs"`
	IsActive     bool         `json:"isActive"`
}

// RegisterProviderRequest parameters to register or update a provider.
type RegisterProviderRequest struct {
	Name        string                 `json:"name"`
	Channel     Channel                `json:"channel"`
	Adapter     string                 `json:"adapter"`
	Credentials map[string]interface{} `json:"credentials"`
	Weight      int                    `json:"weight,omitempty"`
	IsDefault   bool                   `json:"isDefault,omitempty"`
}

// TestProviderConnectionRequest parameters to test provider connectivity.
type TestProviderConnectionRequest struct {
	Channel     Channel                `json:"channel"`
	Adapter     string                 `json:"adapter"`
	Credentials map[string]interface{} `json:"credentials"`
}

// TestProviderConnectionResult outcome of testing provider connectivity.
type TestProviderConnectionResult struct {
	Success   bool   `json:"success"`
	LatencyMs int    `json:"latencyMs"`
	Message   string `json:"message,omitempty"`
	Error     string `json:"error,omitempty"`
}

// AuditLogDto administrative audit log entry.
type AuditLogDto struct {
	ID        string                 `json:"id"`
	Actor     string                 `json:"actor"`
	Action    string                 `json:"action"`
	Target    string                 `json:"target"`
	Timestamp string                 `json:"timestamp"`
	IPAddress string                 `json:"ipAddress,omitempty"`
	Hash      string                 `json:"hash"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// ListAuditLogsQuery query parameters for listing audit logs.
type ListAuditLogsQuery struct {
	Page      int    `json:"page,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Actor     string `json:"actor,omitempty"`
	Action    string `json:"action,omitempty"`
	StartDate string `json:"startDate,omitempty"`
	EndDate   string `json:"endDate,omitempty"`
}

// ListAuditLogsResponse list of audit logs with pagination.
type ListAuditLogsResponse struct {
	Items []AuditLogDto `json:"items"`
	Total int           `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
}

// AdminListMessagesQuery query parameters for multi-tenant message search.
type AdminListMessagesQuery struct {
	Page      int           `json:"page,omitempty"`
	Limit     int           `json:"limit,omitempty"`
	TeamID    string        `json:"teamId,omitempty"`
	Channel   Channel       `json:"channel,omitempty"`
	Status    MessageStatus `json:"status,omitempty"`
	Search    string        `json:"search,omitempty"`
	StartDate string        `json:"startDate,omitempty"`
	EndDate   string        `json:"endDate,omitempty"`
	IsSandbox *bool         `json:"isSandbox,omitempty"`
}

// AdminListMessagesResponse multi-tenant message search results.
type AdminListMessagesResponse struct {
	Messages []MessageDetailDto `json:"messages"`
	Total    int                `json:"total"`
	Page     int                `json:"page"`
	Limit    int                `json:"limit"`
}
