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
		subject := content.Subject
		if subject == "" {
			subject = "Notification"
		}
		html := content.HTML
		if html == "" {
			html = content.Body
		}
		text := content.Body
		if text == "" {
			text = content.HTML
		}
		emailContent := map[string]interface{}{
			"subject": subject,
			"html":    html,
			"text":    text,
		}
		if content.TemplateID != "" {
			render := map[string]interface{}{
				"template": content.TemplateID,
			}
			if content.Variables != nil {
				render["props"] = content.Variables
			}
			emailContent["render"] = render
		}

		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "email",
			"content": emailContent,
		})
	case "sms":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "sms",
			"content": map[string]interface{}{
				"text": content.Body,
			},
		})
	case "whatsapp":
		waContent := map[string]interface{}{}
		if content.Body != "" {
			waContent["text"] = content.Body
		}
		if content.TemplateID != "" {
			waContent["template"] = content.TemplateID
		}
		if content.Variables != nil {
			waContent["variables"] = content.Variables
		}
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "whatsapp",
			"content": waContent,
		})
	case "slack":
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "slack",
			"content": map[string]interface{}{
				"text": content.Body,
			},
		})
	case "push", "fcm":
		subject := content.Subject
		if subject == "" {
			subject = "Notification"
		}
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": "fcm",
			"content": map[string]interface{}{
				"title": subject,
				"body":  content.Body,
			},
		})
	default:
		subject := content.Subject
		if subject == "" {
			subject = "Notification"
		}
		channelsArray = append(channelsArray, map[string]interface{}{
			"channel": channelStr,
			"content": map[string]interface{}{
				"subject": subject,
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
	}

	if req.Metadata != nil {
		wire["metadata"] = req.Metadata
	}
	if req.Template != "" {
		wire["template"] = req.Template
	}
	if req.Variables != nil {
		wire["variables"] = req.Variables
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

	templateObj := req.Template
	if str, ok := req.Template.(string); ok {
		templateObj = map[string]interface{}{"body": str}
	}

	recipientObj := req.Recipient
	if str, ok := req.Recipient.(string); ok {
		recipientObj = map[string]interface{}{"email": str}
	}

	variables := req.Variables
	if variables == nil {
		variables = make(map[string]interface{})
	}

	wire := map[string]interface{}{
		"template":  templateObj,
		"variables": variables,
	}
	if recipientObj != nil {
		wire["recipient"] = recipientObj
	}

	var raw struct {
		Subject          string   `json:"subject"`
		Body             string   `json:"body"`
		Text             string   `json:"text"`
		HTML             string   `json:"html"`
		Rendered         string   `json:"rendered"`
		MissingVariables []string `json:"missingVariables"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/messages/templates/preview", wire, opt, &raw)
	if err != nil {
		return nil, err
	}

	rendered := raw.Rendered
	if rendered == "" {
		if raw.Body != "" {
			rendered = raw.Body
		} else if raw.Text != "" {
			rendered = raw.Text
		} else if raw.HTML != "" {
			rendered = raw.HTML
		}
	}

	return &TemplatePreviewResponse{
		Subject:          raw.Subject,
		Body:             raw.Body,
		Text:             raw.Text,
		HTML:             raw.HTML,
		Rendered:         rendered,
		MissingVariables: raw.MissingVariables,
	}, nil
}

func (r *MessagesResource) formatAcceptedResponse(raw map[string]interface{}) *MessageAcceptedResponse {
	data := raw
	if bodyMap, ok := raw["body"].(map[string]interface{}); ok {
		data = bodyMap
	}

	id, _ := data["messageId"].(string)
	if id == "" {
		id, _ = data["publicId"].(string)
	}

	state, _ := data["state"].(string)
	if state == "" {
		state, _ = data["status"].(string)
	}
	if state == "" {
		state = "accepted"
	}

	createdAt, _ := data["createdAt"].(string)
	if createdAt == "" {
		createdAt = time.Now().UTC().Format(time.RFC3339)
	}

	isSandbox, _ := data["isSandbox"].(bool)
	var idempotencyKey *string
	if k, ok := data["idempotencyKey"].(string); ok {
		idempotencyKey = &k
	}

	var scheduledAt *string
	if s, ok := data["scheduledAt"].(string); ok {
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
