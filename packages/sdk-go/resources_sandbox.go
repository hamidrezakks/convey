package convey

import (
	"context"
	"net/http"
)

// SandboxResource provides tools for simulated zero-cost testing.
type SandboxResource struct {
	http *HTTPClient
}

func newSandboxResource(http *HTTPClient) *SandboxResource {
	return &SandboxResource{http: http}
}

// ListMessages retrieves all simulated sandbox messages.
func (r *SandboxResource) ListMessages(ctx context.Context, opts ...*RequestOptions) (*ListSandboxMessagesResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res ListSandboxMessagesResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/sandbox/messages", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ClearMessages clears simulated sandbox messages for the authenticated team.
func (r *SandboxResource) ClearMessages(ctx context.Context, opts ...*RequestOptions) (*ClearSandboxMessagesResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res ClearSandboxMessagesResponse
	err := r.http.Request(ctx, http.MethodDelete, "/v1/sandbox/messages", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
