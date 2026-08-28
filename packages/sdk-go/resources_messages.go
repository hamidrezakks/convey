package convey

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// MessagesResource provides operations for dispatching and inspecting omnichannel communications.
type MessagesResource struct {
	http *HTTPClient
}

func newMessagesResource(http *HTTPClient) *MessagesResource {
	return &MessagesResource{http: http}
}

// normalizeSendPayload converts an ergonomic SendMessageRequest into wire schema.
func (r *MessagesResource) normalizeSendPayload(req SendMessageRequest) map[string]interface{} {
	if len(req.Channels) > 0 && (req.Recipients != nil || req.Recipient != "") {
		idempotencyKey := req.IdempotencyKey
		if idempotencyKey == "" {
			idempotencyKey = "sdk_" + GenerateULID()
		}

		team := req.Team
		if team == "" {
			team = r.http.teamID
		}
		if team == "" {
			team = "default-team"
		}

		category := req.Category
		if category == "" {
			category = "TRANSACTIONAL"
		}

		country := req.Country
		if country == "" {
			country = "US"
		}

		userID := req.UserID
		if userID == "" {
			userID = "usr_anonymous"
		}

		recipients := req.Recipients
		if recipients == nil {
			recipients = map[string]interface{}{"email": req.Recipient}
		}

		variables := req.Variables
		if variables == nil && req.Content != nil {
			variables = req.Content.Variables
		}

		wire := map[string]interface{}{
			"idempotencyKey": idempotencyKey,
			"userId":         userID,
			"team":           team,
			"category":       category,
			"country":        country,
			"priority":       r.mapPriority(req.Priority),
			"recipients":     recipients,
			"channels":       req.Channels,
			"metadata":       req.Metadata,
		}

		if req.Template != "" {
			wire["template"] = req.Template
		}
		if variables != nil {
			wire["variables"] = variables
		}
		if req.Fallback != nil {
			wire["fallback"] = req.Fallback
		}
		if req.Cascade != nil {
			wire["cascade"] = req.Cascade
		}
		if req.ScheduledAt != nil {
			wire["scheduledAt"] = req.ScheduledAt.UTC().Format(time.RFC3339)
		}

		return wire
	}

	channelStr := strings.ToLower(string(req.Channel))
	if channelStr == "" {
		channelStr = "email"
	}

	recipientsObj := req.Recipients
	if recipientsObj == nil {
		recipientsObj = make(map[string]interface{})
	}

	switch channelStr {
	case "email":
		recipientsObj["email"] = req.Recipient
	case "sms":
		recipientsObj["phone"] = req.Recipient
	case "whatsapp":
		recipientsObj["whatsapp"] = req.Recipient
	case "slack":
		recipientsObj["slack"] = map[string]interface{}{"channelId": req.Recipient}
	case "push", "fcm":
		recipientsObj["fcmTokens"] = []string{req.Recipient}
	case "telegram":
		recipientsObj["telegramChatId"] = req.Recipient
	}

	var channelsArray []interface{}
	content := req.Content
	if content == nil {
		content = &MessageContent{}
	}

	switch channelStr {
	case "email":
		var render map[string]interface{}
		if content.TemplateID != "" {
			render = map[string]interface{}{
				"template": content.TemplateID,
				"props":    content.Variables,
			}
		}

		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "email",
			"content": map[string]interface{}{
				"subject": content.Subject,
				"html":    content.HTML,
				"text":    content.Body,
				"render":  render,
			},
		})
	case "sms":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "sms",
			"content": map[string]interface{}{
				"text": content.Body,
			},
		})
	case "whatsapp":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "whatsapp",
			"content": map[string]interface{}{
				"text":      content.Body,
				"template":  content.TemplateID,
				"variables": content.Variables,
			},
		})
	case "slack":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "slack",
			"content": map[string]interface{}{
				"text": content.Body,
			},
		})
	case "push", "fcm":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "fcm",
			"content": map[string]interface{}{
				"title": content.Subject,
				"body":  content.Body,
			},
		})
	default:
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": channelStr,
			"content": map[string]interface{}{
				"subject": content.Subject,
				"text":    content.Body,
			},
		})
	}

	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = "sdk_" + GenerateULID()
	}

	team := req.Team
	if team == "" {
		team = r.http.teamID
	}
	if team == "" {
		team = "default-team"
	}

	category := req.Category
	if category == "" {
		category = "TRANSACTIONAL"
	}

	country := req.Country
	if country == "" {
		country = "US"
	}

	userID := req.UserID
	if userID == "" {
		userID = "usr_anonymous"
	}

	wire := map[string]interface{}{
		"idempotencyKey": idempotencyKey,
		"userId":         userID,
		"team":           team,
		"category":       category,
		"country":        country,
		"priority":       r.mapPriority(req.Priority),
		"recipients":     recipientsObj,
		"channels":       channelsArray,
		"metadata":       req.Metadata,
	}

	if req.ScheduledAt != nil {
		wire["scheduledAt"] = req.ScheduledAt.UTC().Format(time.RFC3339)
	}

	return wire
}

func (r *MessagesResource) mapPriority(priority MessagePriority) string {
	switch priority {
	case PriorityCritical:
		return "critical"
	case PriorityHigh:
		return "transactional"
	case PriorityDefault:
		return "normal"
	case PriorityLow:
		return "marketing"
	default:
		if priority != "" {
			return strings.ToLower(string(priority))
		}
		return "normal"
	}
}

// Send dispatches a single omnichannel communication message.
func (r *MessagesResource) Send(ctx context.Context, req SendMessageRequest, opts ...*RequestOptions) (*MessageAcceptedResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	wirePayload := r.normalizeSendPayload(req)
	var raw map[string]interface{}

	err := r.http.Request(ctx, http.MethodPost, "/v1/messages", wirePayload, opt, &raw)
	if err != nil {
		return nil, err
	}

	return r.formatAcceptedResponse(raw), nil
}

// SendBulk ingests an array of messages into the transactional outbox pipeline in a single batch.
func (r *MessagesResource) SendBulk(ctx context.Context, messages []SendMessageRequest, opts ...*RequestOptions) (*BulkMessageResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var normalized []map[string]interface{}
	for _, m := range messages {
		normalized = append(normalized, r.normalizeSendPayload(m))
	}

	var rawRes struct {
		Total int                      `json:"total"`
		Items []map[string]interface{} `json:"items"`
	}

	err := r.http.Request(ctx, http.MethodPost, "/v1/messages/bulk", map[string]interface{}{
		"messages": normalized,
	}, opt, &rawRes)
	if err != nil {
		return nil, err
	}

	items := make([]MessageAcceptedResponse, 0, len(rawRes.Items))
	for _, item := range rawRes.Items {
		items = append(items, *r.formatAcceptedResponse(item))
	}

	total := rawRes.Total
	if total == 0 {
		total = len(items)
	}

	return &BulkMessageResponse{
		Total: total,
		Items: items,
	}, nil
}

// Get retrieves current message lifecycle status and provider attempt history.
func (r *MessagesResource) Get(ctx context.Context, messageID string, opts ...*RequestOptions) (*MessageDetailDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var detail MessageDetailDto
	err := r.http.Request(ctx, http.MethodGet, "/v1/messages/"+url.PathEscape(messageID), nil, opt, &detail)
	if err != nil {
		return nil, err
	}
	return &detail, nil
}

// GetTimeline retrieves the chronological lifecycle timeline for a message.
func (r *MessagesResource) GetTimeline(ctx context.Context, messageID string, opts ...*RequestOptions) (*MessageTimelineResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var timeline MessageTimelineResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/messages/"+url.PathEscape(messageID)+"/timeline", nil, opt, &timeline)
	if err != nil {
		return nil, err
	}
	return &timeline, nil
}

// GetTrace retrieves the W3C distributed trace span waterfall for a message.
func (r *MessagesResource) GetTrace(ctx context.Context, messageID string, opts ...*RequestOptions) (*MessageTraceResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var trace MessageTraceResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/messages/"+url.PathEscape(messageID)+"/trace", nil, opt, &trace)
	if err != nil {
		return nil, err
	}
	return &trace, nil
}

// PreviewTemplate tests variable rendering against a message template.
func (r *MessagesResource) PreviewTemplate(ctx context.Context, req TemplatePreviewRequest, opts ...*RequestOptions) (*TemplatePreviewResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	wire := map[string]interface{}{
		"template":  req.Template,
		"variables": req.Variables,
		"recipient": req.Recipient,
	}

	var res TemplatePreviewResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/messages/templates/preview", wire, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *MessagesResource) formatAcceptedResponse(raw map[string]interface{}) *MessageAcceptedResponse {
	id, _ := raw["messageId"].(string)
	if id == "" {
		id, _ = raw["publicId"].(string)
	}

	state, _ := raw["state"].(string)
	if state == "" {
		state, _ = raw["status"].(string)
	}
	if state == "" {
		state = "accepted"
	}

	createdAt, _ := raw["createdAt"].(string)
	if createdAt == "" {
		createdAt = time.Now().UTC().Format(time.RFC3339)
	}

	isSandbox, _ := raw["isSandbox"].(bool)
	var idempotencyKey *string
	if k, ok := raw["idempotencyKey"].(string); ok {
		idempotencyKey = &k
	}

	var scheduledAt *string
	if s, ok := raw["scheduledAt"].(string); ok {
		scheduledAt = &s
	}

	return &MessageAcceptedResponse{
		MessageID:      id,
		PublicID:       id,
		State:          state,
		Status:         MessageStatus(strings.ToUpper(state)),
		CreatedAt:      createdAt,
		AcceptedAt:     createdAt,
		ScheduledAt:    scheduledAt,
		Success:        true,
		IsSandbox:      isSandbox,
		IdempotencyKey: idempotencyKey,
	}
}
