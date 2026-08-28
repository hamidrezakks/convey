package convey

import (
	"context"
	"net/http"
	"net/url"
)

// BatchesResource manages campaign batch dispatch containers and lifecycle.
type BatchesResource struct {
	http *HTTPClient
}

func newBatchesResource(http *HTTPClient) *BatchesResource {
	return &BatchesResource{http: http}
}

// Create creates a new campaign batch.
func (r *BatchesResource) Create(ctx context.Context, req CreateBatchRequest, opts ...*RequestOptions) (*CreateBatchResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res CreateBatchResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/batches", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// List retrieves campaign batches for the authenticated team.
func (r *BatchesResource) List(ctx context.Context, opts ...*RequestOptions) (*ListBatchesResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res ListBatchesResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/batches", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// Get retrieves details for a specific batch.
func (r *BatchesResource) Get(ctx context.Context, batchID string, opts ...*RequestOptions) (*BatchDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool     `json:"success"`
		Batch   BatchDto `json:"batch"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/v1/batches/"+url.PathEscape(batchID), nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Batch, nil
}

// Pause pauses active dispatching of an in-flight batch.
func (r *BatchesResource) Pause(ctx context.Context, batchID string, opts ...*RequestOptions) (*BatchActionResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res BatchActionResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/batches/"+url.PathEscape(batchID)+"/pause", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// Resume resumes dispatching of a paused batch.
func (r *BatchesResource) Resume(ctx context.Context, batchID string, opts ...*RequestOptions) (*BatchActionResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res BatchActionResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/batches/"+url.PathEscape(batchID)+"/resume", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// Cancel cancels execution of an active or paused batch.
func (r *BatchesResource) Cancel(ctx context.Context, batchID string, opts ...*RequestOptions) (*BatchActionResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res BatchActionResponse
	err := r.http.Request(ctx, http.MethodPost, "/v1/batches/"+url.PathEscape(batchID)+"/cancel", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
