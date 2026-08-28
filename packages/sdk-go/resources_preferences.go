package convey

import (
	"context"
	"net/http"
	"net/url"
)

// PreferencesResource manages recipient communication preferences and topics.
type PreferencesResource struct {
	http *HTTPClient
}

func newPreferencesResource(http *HTTPClient) *PreferencesResource {
	return &PreferencesResource{http: http}
}

// ListTopics returns subscription topics for a tenant and team.
func (r *PreferencesResource) ListTopics(ctx context.Context, tenantID, team string, opts ...*RequestOptions) ([]SubscriptionTopicDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = map[string]string{
		"tenantId": tenantID,
		"team":     team,
	}

	var res struct {
		Success bool                   `json:"success"`
		Topics  []SubscriptionTopicDto `json:"topics"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/api/v1/plugins/preferences/topics", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return res.Topics, nil
}

// CreateTopic creates or updates a subscription topic.
func (r *PreferencesResource) CreateTopic(ctx context.Context, data map[string]interface{}, opts ...*RequestOptions) (*SubscriptionTopicDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool                 `json:"success"`
		Topic   SubscriptionTopicDto `json:"topic"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/api/v1/plugins/preferences/topics", data, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Topic, nil
}

// GetPreferences retrieves preferences for a recipient.
func (r *PreferencesResource) GetPreferences(ctx context.Context, tenantID, recipientID string, opts ...*RequestOptions) (*RecipientPreferencesDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = map[string]string{"tenantId": tenantID}

	var res struct {
		Success     bool                    `json:"success"`
		Preferences RecipientPreferencesDto `json:"preferences"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/api/v1/plugins/preferences/"+url.PathEscape(recipientID), nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Preferences, nil
}

// Check verifies dispatch consent against recipient quiet hours and topic opt-outs.
func (r *PreferencesResource) Check(ctx context.Context, data map[string]interface{}, opts ...*RequestOptions) (*PreferenceCheckResult, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool    `json:"success"`
		Allowed bool    `json:"allowed"`
		Reason  *string `json:"reason,omitempty"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/api/v1/plugins/preferences/check", data, opt, &res)
	if err != nil {
		return nil, err
	}
	return &PreferenceCheckResult{
		Allowed: res.Allowed,
		Reason:  res.Reason,
	}, nil
}
