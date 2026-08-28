package convey

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// AdminResource provides platform management, telemetry inspection, and provider cockpit controls.
type AdminResource struct {
	http *HTTPClient
}

func newAdminResource(http *HTTPClient) *AdminResource {
	return &AdminResource{http: http}
}

// GetOverview retrieves high-level system operational metrics.
func (r *AdminResource) GetOverview(ctx context.Context, opts ...*RequestOptions) (map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res map[string]interface{}
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/overview", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// GetLiveTelemetry retrieves real-time cluster telemetry snapshot.
func (r *AdminResource) GetLiveTelemetry(ctx context.Context, opts ...*RequestOptions) (*LiveTelemetrySnapshot, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res LiveTelemetrySnapshot
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/telemetry/live", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListMessages queries messages across all tenants and teams.
func (r *AdminResource) ListMessages(ctx context.Context, query *AdminListMessagesQuery, opts ...*RequestOptions) (*AdminListMessagesResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	q := make(map[string]string)
	if query != nil {
		if query.Page > 0 {
			q["page"] = fmt.Sprintf("%d", query.Page)
		}
		if query.Limit > 0 {
			q["limit"] = fmt.Sprintf("%d", query.Limit)
		}
		if query.TeamID != "" {
			q["teamId"] = query.TeamID
		}
		if query.Channel != "" {
			q["channel"] = string(query.Channel)
		}
		if query.Status != "" {
			q["status"] = string(query.Status)
		}
		if query.Search != "" {
			q["search"] = query.Search
		}
		if query.StartDate != "" {
			q["startDate"] = query.StartDate
		}
		if query.EndDate != "" {
			q["endDate"] = query.EndDate
		}
		if query.IsSandbox != nil {
			q["isSandbox"] = fmt.Sprintf("%t", *query.IsSandbox)
		}
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = q

	var res AdminListMessagesResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/messages", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListMessagesAutoPaging streams messages across all tenants.
func (r *AdminResource) ListMessagesAutoPaging(query *AdminListMessagesQuery, opts ...*RequestOptions) *AutoPaginator[MessageDetailDto] {
	limit := 50
	if query != nil && query.Limit > 0 {
		limit = query.Limit
	}

	return NewAutoPaginator(func(ctx context.Context, offset int, page int) ([]MessageDetailDto, bool, error) {
		q := &AdminListMessagesQuery{}
		if query != nil {
			*q = *query
		}
		q.Limit = limit
		q.Page = page

		res, err := r.ListMessages(ctx, q, opts...)
		if err != nil {
			return nil, false, err
		}

		hasMore := res.Page*res.Limit < res.Total
		return res.Messages, hasMore, nil
	}, limit)
}

// GetMessageDetails retrieves full details and trace spans for a message.
func (r *AdminResource) GetMessageDetails(ctx context.Context, id string, opts ...*RequestOptions) (*MessageDetailDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res MessageDetailDto
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/messages/"+url.PathEscape(id), nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListProviders returns all communication providers with health and circuit breaker metrics.
func (r *AdminResource) ListProviders(ctx context.Context, opts ...*RequestOptions) ([]ProviderHealthDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res []ProviderHealthDto
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/providers", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// SetCircuitState overrides provider circuit breaker state or triggers stepped traffic ramp.
func (r *AdminResource) SetCircuitState(ctx context.Context, providerID, action string, rampPercentage int, opts ...*RequestOptions) (map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	if rampPercentage <= 0 {
		rampPercentage = 20
	}

	var res map[string]interface{}
	err := r.http.Request(ctx, http.MethodPost, "/v1/admin/providers/"+url.PathEscape(providerID)+"/circuit", map[string]interface{}{
		"action":         action,
		"rampPercentage": rampPercentage,
	}, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// TriggerCanary executes a synthetic canary probe against a provider.
func (r *AdminResource) TriggerCanary(ctx context.Context, providerID string, opts ...*RequestOptions) (map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res map[string]interface{}
	err := r.http.Request(ctx, http.MethodPost, "/v1/admin/providers/"+url.PathEscape(providerID)+"/canary", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// GetProviderCatalog returns the complete turnkey provider catalog.
func (r *AdminResource) GetProviderCatalog(ctx context.Context, opts ...*RequestOptions) (map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res map[string]interface{}
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/providers/catalog", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// ListConfiguredProviders returns active configured provider integrations.
func (r *AdminResource) ListConfiguredProviders(ctx context.Context, opts ...*RequestOptions) ([]map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res []map[string]interface{}
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/providers/configured", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// RegisterProvider dynamically registers or updates a provider integration.
func (r *AdminResource) RegisterProvider(ctx context.Context, req RegisterProviderRequest, opts ...*RequestOptions) (map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res map[string]interface{}
	err := r.http.Request(ctx, http.MethodPost, "/v1/admin/providers/register", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// DeleteConfiguredProvider deletes a configured provider integration.
func (r *AdminResource) DeleteConfiguredProvider(ctx context.Context, id string, opts ...*RequestOptions) (bool, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool `json:"success"`
	}
	err := r.http.Request(ctx, http.MethodDelete, "/v1/admin/providers/configured/"+url.PathEscape(id), nil, opt, &res)
	if err != nil {
		return false, err
	}
	return res.Success, nil
}

// TestProviderConnection tests credentials and live connectivity for a provider.
func (r *AdminResource) TestProviderConnection(ctx context.Context, req TestProviderConnectionRequest, opts ...*RequestOptions) (*TestProviderConnectionResult, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res TestProviderConnectionResult
	err := r.http.Request(ctx, http.MethodPost, "/v1/admin/providers/test-connection", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListAuditLogs queries the tamper-evident audit log ledger.
func (r *AdminResource) ListAuditLogs(ctx context.Context, query *ListAuditLogsQuery, opts ...*RequestOptions) (*ListAuditLogsResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	q := make(map[string]string)
	if query != nil {
		if query.Page > 0 {
			q["page"] = fmt.Sprintf("%d", query.Page)
		}
		if query.Limit > 0 {
			q["limit"] = fmt.Sprintf("%d", query.Limit)
		}
		if query.Actor != "" {
			q["actor"] = query.Actor
		}
		if query.Action != "" {
			q["action"] = query.Action
		}
		if query.StartDate != "" {
			q["startDate"] = query.StartDate
		}
		if query.EndDate != "" {
			q["endDate"] = query.EndDate
		}
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = q

	var res ListAuditLogsResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/audit-logs", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ListAuditLogsAutoPaging streams audit logs across pages.
func (r *AdminResource) ListAuditLogsAutoPaging(query *ListAuditLogsQuery, opts ...*RequestOptions) *AutoPaginator[AuditLogDto] {
	limit := 50
	if query != nil && query.Limit > 0 {
		limit = query.Limit
	}

	return NewAutoPaginator(func(ctx context.Context, offset int, page int) ([]AuditLogDto, bool, error) {
		q := &ListAuditLogsQuery{}
		if query != nil {
			*q = *query
		}
		q.Limit = limit
		q.Page = page

		res, err := r.ListAuditLogs(ctx, q, opts...)
		if err != nil {
			return nil, false, err
		}

		hasMore := res.Page*res.Limit < res.Total
		return res.Items, hasMore, nil
	}, limit)
}

// ListPolicies lists rate limiting, token bucket, quiet hours, and budget policies.
func (r *AdminResource) ListPolicies(ctx context.Context, opts ...*RequestOptions) ([]map[string]interface{}, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res []map[string]interface{}
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/policies", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}
