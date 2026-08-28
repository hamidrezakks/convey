package convey

import (
	"context"
	"net/http"
	"net/url"
)

// TemplatesResource manages multi-channel communication templates, versions, and partials.
type TemplatesResource struct {
	http *HTTPClient
}

func newTemplatesResource(http *HTTPClient) *TemplatesResource {
	return &TemplatesResource{http: http}
}

// List returns templates with optional environment filter.
func (r *TemplatesResource) List(ctx context.Context, environment string, opts ...*RequestOptions) ([]TemplateDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	mergedOpt := &RequestOptions{}
	if opt != nil {
		*mergedOpt = *opt
	}
	if environment != "" {
		mergedOpt.Query = map[string]string{"environment": environment}
	}

	var res struct {
		Success   bool          `json:"success"`
		Templates []TemplateDto `json:"templates"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/v1/templates", nil, mergedOpt, &res)
	if err != nil {
		return nil, err
	}
	return res.Templates, nil
}

// Get retrieves a template by slug along with all versions.
func (r *TemplatesResource) Get(ctx context.Context, slug string, opts ...*RequestOptions) (*TemplateDto, []TemplateVersionDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success  bool                 `json:"success"`
		Template TemplateDto          `json:"template"`
		Versions []TemplateVersionDto `json:"versions"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/v1/templates/"+url.PathEscape(slug), nil, opt, &res)
	if err != nil {
		return nil, nil, err
	}
	return &res.Template, res.Versions, nil
}

// Create creates a new template.
func (r *TemplatesResource) Create(ctx context.Context, req CreateTemplateRequest, opts ...*RequestOptions) (*TemplateDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success  bool        `json:"success"`
		Template TemplateDto `json:"template"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/templates", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Template, nil
}

// CreateVersion creates a new draft version for a template.
func (r *TemplatesResource) CreateVersion(ctx context.Context, slug string, req CreateTemplateVersionRequest, opts ...*RequestOptions) (*TemplateVersionDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool               `json:"success"`
		Version TemplateVersionDto `json:"version"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/templates/"+url.PathEscape(slug)+"/versions", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Version, nil
}

// PublishVersion publishes a draft version as active.
func (r *TemplatesResource) PublishVersion(ctx context.Context, slug string, version string, opts ...*RequestOptions) (*TemplateDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success  bool        `json:"success"`
		Template TemplateDto `json:"template"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/templates/"+url.PathEscape(slug)+"/publish", map[string]string{
		"version": version,
	}, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Template, nil
}

// Render renders a template with variable substitution.
func (r *TemplatesResource) Render(ctx context.Context, req RenderTemplateRequest, opts ...*RequestOptions) (*RenderTemplateResponse, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success  bool                   `json:"success"`
		Rendered RenderTemplateResponse `json:"rendered"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/templates/render", req, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Rendered, nil
}

// ListPartials retrieves all reusable template partials.
func (r *TemplatesResource) ListPartials(ctx context.Context, opts ...*RequestOptions) ([]TemplatePartialDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success  bool                 `json:"success"`
		Partials []TemplatePartialDto `json:"partials"`
	}
	err := r.http.Request(ctx, http.MethodGet, "/v1/templates/partials", nil, opt, &res)
	if err != nil {
		return nil, err
	}
	return res.Partials, nil
}

// UpsertPartial creates or updates a reusable partial component.
func (r *TemplatesResource) UpsertPartial(ctx context.Context, name, content string, opts ...*RequestOptions) (*TemplatePartialDto, error) {
	var opt *RequestOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	var res struct {
		Success bool               `json:"success"`
		Partial TemplatePartialDto `json:"partial"`
	}
	err := r.http.Request(ctx, http.MethodPost, "/v1/templates/partials", map[string]string{
		"name":    name,
		"content": content,
	}, opt, &res)
	if err != nil {
		return nil, err
	}
	return &res.Partial, nil
}
