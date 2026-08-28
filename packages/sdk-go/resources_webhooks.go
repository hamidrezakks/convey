package convey

import (
	"context"
	"net/http"
	"net/url"
	"time"
)

// WebhookSubscriptionsResource handles endpoint registrations.
type WebhookSubscriptionsResource struct {
	http *HTTPClient
}

func newWebhookSubscriptionsResource(http *HTTPClient) *WebhookSubscriptionsResource {
	return &WebhookSubscriptionsResource{http: http}
}

// Create registers a new webhook subscription endpoint.
func (r *WebhookSubscriptionsResource) Create(ctx context.Context, req CreateWebhookSubscriptionRequest, opts ...*RequestOptions) (*CreateWebhookSubscriptionResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res CreateWebhookSubscriptionResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/webhook-subscriptions", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// List returns all registered webhook subscriptions.
func (r *WebhookSubscriptionsResource) List(ctx context.Context, opts ...*RequestOptions) (*ListWebhookSubscriptionsResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res ListWebhookSubscriptionsResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/webhook-subscriptions", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// Delete removes a webhook subscription endpoint by ID.
func (r *WebhookSubscriptionsResource) Delete(ctx context.Context, id string, opts ...*RequestOptions) (bool, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool `json:"success"`
	}
	err := r.http.Request(ctx, http.MethodDelete, "/v1/webhook-subscriptions/"+url.PathEscape(id), nil, opt, &res)
	if err != nil {
		return false, err
	}
	return res.Success, nil
}

// Test sends a synthetic test ping to verify endpoint connectivity.
func (r *WebhookSubscriptionsResource) Test(ctx context.Context, id string, opts ...*RequestOptions) (bool, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/webhook-subscriptions/"+url.PathEscape(id)+"/test", nil, opt, &res)
	if err != nil {
		return false, err
	}
	return res.Success, nil
}

// WebhooksResource aggregates webhook subscription management and cryptographic helpers.
type WebhooksResource struct {
	Subscriptions *WebhookSubscriptionsResource
}

func newWebhooksResource(http *HTTPClient) *WebhooksResource {
	return &WebhooksResource{
		Subscriptions: newWebhookSubscriptionsResource(http),
	}
}

// VerifySignature verifies HMAC-SHA256 signature against an incoming payload.
func (r *WebhooksResource) VerifySignature(payload []byte, signatureHeader string, secret string, tolerance time.Duration) bool {
	return VerifyWebhookSignature(payload, signatureHeader, secret, tolerance)
}

// ConstructEvent verifies signature and deserializes incoming webhook payload.
func (r *WebhooksResource) ConstructEvent(payload []byte, signatureHeader string, secret string, tolerance time.Duration) (*ConveyWebhookEvent[map[string]interface{}], error) {
	return ConstructWebhookEvent[map[string]interface{}](payload, signatureHeader, secret, tolerance)
}
