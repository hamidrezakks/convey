package convey

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// ReportsResource provides multi-dimensional analytics, budget tracking, and export capabilities.
type ReportsResource struct {
	http *HTTPClient
}

func newReportsResource(http *HTTPClient) *ReportsResource {
	return &ReportsResource{http: http}
}

func buildReportQueryParams(params *ReportingQueryParams) map[string]string {
	if params == nil {
		return nil
	}
	q := make(map[string]string)
	if params.StartDate != "" {
		q["startDate"] = params.StartDate
	}
	if params.EndDate != "" {
		q["endDate"] = params.EndDate
	}
	if params.TeamID != "" {
		q["teamId"] = params.TeamID
	}
	if params.Category != "" {
		q["category"] = params.Category
	}
	if params.Channel != "" {
		q["channel"] = string(params.Channel)
	}
	if params.IsSandbox != nil {
		q["isSandbox"] = fmt.Sprintf("%t", *params.IsSandbox)
	}
	if params.Limit > 0 {
		q["limit"] = fmt.Sprintf("%d", params.Limit)
	}
	if params.Offset > 0 {
		q["offset"] = fmt.Sprintf("%d", params.Offset)
	}
	return q
}

// GetOverview returns aggregated omnichannel delivery metrics and costs.
func (r *ReportsResource) GetOverview(ctx context.Context, params *ReportingQueryParams, opts ...*RequestOptions) (*ReportingOverviewResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = buildReportQueryParams(params)

	var res ReportingOverviewResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/overview", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// GetTeams returns metrics and budget utilization across tenant teams.
func (r *ReportsResource) GetTeams(ctx context.Context, params *ReportingQueryParams, opts ...*RequestOptions) (*TeamsReportResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = buildReportQueryParams(params)

	var res TeamsReportResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/teams", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// GetCategories returns metrics segmented by message category.
func (r *ReportsResource) GetCategories(ctx context.Context, params *ReportingQueryParams, opts ...*RequestOptions) (*CategoriesReportResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = buildReportQueryParams(params)

	var res CategoriesReportResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/categories", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// GetCampaigns returns performance metrics across all campaigns.
func (r *ReportsResource) GetCampaigns(ctx context.Context, params *ReportingQueryParams, opts ...*RequestOptions) (*CampaignsReportResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = buildReportQueryParams(params)

	var res CampaignsReportResponse
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/campaigns", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// GetCampaignDetails returns detailed funnel analysis for a specific campaign.
func (r *ReportsResource) GetCampaignDetails(ctx context.Context, campaignID string, params *ReportingQueryParams, opts ...*RequestOptions) (*CampaignDetailDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = buildReportQueryParams(params)

	var res CampaignDetailDto
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/campaigns/"+url.PathEscape(campaignID), nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// Export exports raw report data in CSV or JSON format.
func (r *ReportsResource) Export(ctx context.Context, reportType string, format string, params *ReportingQueryParams, opts ...*RequestOptions) (string, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	q := buildReportQueryParams(params)
	if q == nil {
		q = make(map[string]string)
	}
	q["type"] = reportType
	if format == "" {
		format = "csv"
	}
	q["format"] = format

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	mergedOpt.Query = q

	var output string
	err := r.http.Request(ctx, http.MethodGet, "/v1/admin/reports/export", nil, mergedOpt, &output)
	if err != nil {
		return "", err
	}
	return output, nil
}
