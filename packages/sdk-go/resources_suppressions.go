package convey

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// SuppressionsResource manages bounce, complaint, unsubscribe, and manual suppression records.
type SuppressionsResource struct {
	http *HTTPClient
}

func newSuppressionsResource(http *HTTPClient) *SuppressionsResource {
	return &SuppressionsResource{http: http}
}

// Add adds a single recipient to the suppression ledger.
func (r *SuppressionsResource) Add(ctx context.Context, req AddSuppressionRequest, opts ...*RequestOptions) (*SuppressionDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success     bool           `json:"success"`
		Suppression SuppressionDto `json:"suppression"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/suppressions", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Suppression, nil
}

// AddBulk registers multiple recipient suppressions in a single operation.
func (r *SuppressionsResource) AddBulk(ctx context.Context, items []AddSuppressionRequest, opts ...*RequestOptions) ([]SuppressionDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success      bool             `json:"success"`
		Count        int              `json:"count"`
		Suppressions []SuppressionDto `json:"suppressions"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/suppressions/bulk", map[string]interface{}{
		"items": items,
	}, opt, &res)
	if err != nil {
		return nil, err
	}
	return res.Suppressions, nil
}

// List queries suppression records with search and filter parameters.
func (r *SuppressionsResource) List(ctx context.Context, query *ListSuppressionsQuery, opts ...*RequestOptions) (*ListSuppressionsResponse, error) {
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
		if query.Channel != "" {
			queryParams["channel"] = string(query.Channel)
		}
		if query.Reason != "" {
			queryParams["reason"] = string(query.Reason)
		}
		if query.Category != "" {
			queryParams["category"] = query.Category
		}
		if query.Search != "" {
			queryParams["search"] = query.Search
		}
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = queryParams

	var res struct {
		Suppressions []SuppressionDto `json:"suppressions"`
		Items        []SuppressionDto `json:"items"`
		Total        int              `json:"total"`
		Limit        int              `json:"limit"`
		Offset       int              `json:"offset"`
	}

	err := r.http.Request(ctx, http.MethodGet, "/v1/suppressions", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}

	items := res.Suppressions
	if len(items) == 0 {
		items = res.Items
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

	return &ListSuppressionsResponse{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: res.Offset,
	}, nil
}

// ListAutoPaging streams suppression records across multiple pages using an AutoPaginator.
func (r *SuppressionsResource) ListAutoPaging(query *ListSuppressionsQuery, opts ...*RequestOptions) *AutoPaginator[SuppressionDto] {
	limit := 50
	if query != nil && query.Limit > 0 {
		limit = query.Limit
	}

	return NewAutoPaginator(func(ctx context.Context, offset int, page int) ([]SuppressionDto, bool, error) {
		q := &ListSuppressionsQuery{}
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

// Delete removes a suppression rule by identifier.
func (r *SuppressionsResource) Delete(ctx context.Context, id string, opts ...*RequestOptions) (bool, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool `json:"success"`
	}
	err := r.http.Request(ctx, http.MethodDelete, "/v1/suppressions/"+url.PathEscape(id), nil, opt, &res)
	if err != nil {
		return false, err
	}
	return res.Success, nil
}
