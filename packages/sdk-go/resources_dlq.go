package convey

import (
	"context"
	"fmt"
	"net/http"
)

// DLQResource provides inspection and replay controls over the Dead-Letter Queue.
type DLQResource struct {
	http *HTTPClient
}

func newDLQResource(http *HTTPClient) *DLQResource {
	return &DLQResource{http: http}
}

// List queries failed messages in the Dead-Letter Queue.
func (r *DLQResource) List(ctx context.Context, query *ListDlqQuery, opts ...*RequestOptions) (*ListDlqResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	queryParams := make(map[string]string)
	if query != nil {
		if query.Limit > 0 {
			queryParams["limit"] = fmt.Sprintf("%d", query.Limit)
		}
		if query.Offset > 0 {
			queryParams["offset"] = fmt.Sprintf("%d", query.Offset)
		}
		if query.Team != "" {
			queryParams["team"] = query.Team
		}
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = queryParams

	var res struct {
		Items    []MessageDetailDto `json:"items"`
		Messages []MessageDetailDto `json:"messages"`
		Total    int                `json:"total"`
		Limit    int                `json:"limit"`
		Offset   int                `json:"offset"`
	}

	err := r.http.Request(ctx, http.MethodGet, "/v1/dlq", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}

	items := res.Items
	if len(items) == 0 {
		items = res.Messages
	}

	limit := res.Limit
	if limit == 0 && query != nil && query.Limit > 0 {
		limit = query.Limit
	} else if limit == 0 {
		limit = 50
	}

	total := res.Total
	if total == 0 {
		total = len(items)
	}

	return &ListDlqResponse{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: res.Offset,
	}, nil
}

// ListAutoPaging streams DLQ messages across multiple pages using an AutoPaginator.
func (r *DLQResource) ListAutoPaging(query *ListDlqQuery, opts ...*RequestOptions) *AutoPaginator[MessageDetailDto] {
	limit := 50
	if query != nil && query.Limit > 0 {
		limit = query.Limit
	}

	return NewAutoPaginator(func(ctx context.Context, offset int, page int) ([]MessageDetailDto, bool, error) {
		q := &ListDlqQuery{}
		if query != nil {
			*q = *query
		}
		q.Limit = limit
		q.Offset = offset

		res, err := r.List(ctx, q, opts...)
		if err != nil {
			return nil, false, err
		}

		hasMore := res.Offset+len(res.Items) < res.Total
		return res.Items, hasMore, nil
	}, limit)
}

// Replay re-injects failed messages into the transactional outbox pipeline.
func (r *DLQResource) Replay(ctx context.Context, req DlqReplayRequest, opts ...*RequestOptions) (*DlqReplayResult, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res DlqReplayResult
	err := r.http.Request(ctx, http.MethodPost, "/v1/dlq/replay", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ReplayMutated executes dry-run simulations or mutated replays with concurrency tuning.
func (r *DLQResource) ReplayMutated(ctx context.Context, req DlqMutatedReplayRequest, opts ...*RequestOptions) (*DlqMutatedReplayResult, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res DlqMutatedReplayResult
	err := r.http.Request(ctx, http.MethodPost, "/v1/dlq/replay-mutated", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
