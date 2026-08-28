package convey

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// InboxResource manages in-app notifications and feeds.
type InboxResource struct {
	http *HTTPClient
}

func newInboxResource(http *HTTPClient) *InboxResource {
	return &InboxResource{http: http}
}

// Create creates an in-app notification.
func (r *InboxResource) Create(ctx context.Context, data map[string]interface{}, opts ...*RequestOptions) (*InAppNotificationDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success      bool                 `json:"success"`
		Notification InAppNotificationDto `json:"notification"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/api/v1/plugins/inbox", data, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Notification, nil
}

// GetFeed retrieves an in-app notification feed.
func (r *InboxResource) GetFeed(ctx context.Context, tenantID, recipientID string, unreadOnly bool, page, limit int, opts ...*RequestOptions) (*InAppFeedResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	q := map[string]string{
		"tenantId": tenantID,
	}
	if unreadOnly {
		q["unreadOnly"] = "true"
	}
	if page > 0 {
		q["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		q["limit"] = fmt.Sprintf("%d", limit)
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = q

	var res struct {
		Success       bool                   `json:"success"`
		Notifications []InAppNotificationDto `json:"notifications"`
		UnreadCount   int                    `json:"unreadCount"`
		Total         int                    `json:"total"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/api/v1/plugins/inbox/"+url.PathEscape(recipientID), nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &InAppFeedResponse{
		Notifications: res.Notifications,
		UnreadCount:   res.UnreadCount,
		Total:         res.Total,
	}, nil
}

// MarkRead marks notifications as read.
func (r *InboxResource) MarkRead(ctx context.Context, tenantID, recipientID string, notificationIDs []string, opts ...*RequestOptions) (int, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success      bool `json:"success"`
		UpdatedCount int  `json:"updatedCount"`
	}
	err := r.http.Request(ctx, http.MethodPatch, "/api/v1/plugins/inbox/"+url.PathEscape(recipientID)+"/read", map[string]interface{}{
		"tenantId":        tenantID,
		"notificationIds": notificationIDs,
	}, opt, &res)
	if err != nil {
		return 0, err
	}
	return res.UpdatedCount, nil
}

// MarkAllRead marks all recipient notifications as read.
func (r *InboxResource) MarkAllRead(ctx context.Context, tenantID, recipientID string, opts ...*RequestOptions) (bool, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool `json:"success"`
	}
	err := r.http.Request(ctx, http.MethodPatch, "/api/v1/plugins/inbox/"+url.PathEscape(recipientID)+"/read-all", map[string]interface{}{
		"tenantId": tenantID,
	}, opt, &res)
	if err != nil {
		return false, err
	}
	return res.Success, nil
}

// Archive archives notifications.
func (r *InboxResource) Archive(ctx context.Context, tenantID, recipientID string, notificationIDs []string, opts ...*RequestOptions) (int, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success       bool `json:"success"`
		ArchivedCount int  `json:"archivedCount"`
	}
	err := r.http.Request(ctx, http.MethodPatch, "/api/v1/plugins/inbox/"+url.PathEscape(recipientID)+"/archive", map[string]interface{}{
		"tenantId":        tenantID,
		"notificationIds": notificationIDs,
	}, opt, &res)
	if err != nil {
		return 0, err
	}
	return res.ArchivedCount, nil
}
