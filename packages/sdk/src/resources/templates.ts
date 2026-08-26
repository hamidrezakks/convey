import type { HttpClient } from '../http';
import type {
  CreateTemplateRequest,
  CreateTemplateVersionRequest,
  RenderTemplateRequest,
  RenderTemplateResponse,
  RequestOptions,
  TemplateDto,
  TemplatePartialDto,
  TemplateVersionDto,
} from '../types';

export class TemplatesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List templates with optional environment filter.
   */
  async list(
    options?: { environment?: string } & RequestOptions,
  ): Promise<{ success: boolean; templates: TemplateDto[] }> {
    const query: Record<string, string> = {};
    if (options?.environment) query.environment = options.environment;
    return this.http.request<{ success: boolean; templates: TemplateDto[] }>('/v1/templates', {
      method: 'GET',
      query,
      ...options,
    });
  }

  /**
   * Get template by slug with all its versions.
   */
  async get(
    slug: string,
    options?: RequestOptions,
  ): Promise<{ success: boolean; template: TemplateDto; versions: TemplateVersionDto[] }> {
    return this.http.request<{ success: boolean; template: TemplateDto; versions: TemplateVersionDto[] }>(
      `/v1/templates/${encodeURIComponent(slug)}`,
      {
        method: 'GET',
        ...options,
      },
    );
  }

  /**
   * Create a new template with an initial version.
   */
  async create(
    request: CreateTemplateRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; template: TemplateDto }> {
    return this.http.request<{ success: boolean; template: TemplateDto }>('/v1/templates', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * Create a new draft semantic version for a template.
   */
  async createVersion(
    slug: string,
    request: CreateTemplateVersionRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; version: TemplateVersionDto }> {
    return this.http.request<{ success: boolean; version: TemplateVersionDto }>(
      `/v1/templates/${encodeURIComponent(slug)}/versions`,
      {
        method: 'POST',
        body: request,
        ...options,
      },
    );
  }

  /**
   * Publish a draft version as the active production version.
   */
  async publishVersion(
    slug: string,
    version: string,
    options?: RequestOptions,
  ): Promise<{ success: boolean; template: TemplateDto }> {
    return this.http.request<{ success: boolean; template: TemplateDto }>(
      `/v1/templates/${encodeURIComponent(slug)}/publish`,
      {
        method: 'POST',
        body: { version },
        ...options,
      },
    );
  }

  /**
   * Compile and render a template with variables and locale fallback.
   */
  async render(
    request: RenderTemplateRequest,
    options?: RequestOptions,
  ): Promise<{ success: boolean; rendered: RenderTemplateResponse }> {
    return this.http.request<{ success: boolean; rendered: RenderTemplateResponse }>(
      '/v1/templates/render',
      {
        method: 'POST',
        body: request,
        ...options,
      },
    );
  }

  /**
   * List reusable template partials.
   */
  async listPartials(
    options?: RequestOptions,
  ): Promise<{ success: boolean; partials: TemplatePartialDto[] }> {
    return this.http.request<{ success: boolean; partials: TemplatePartialDto[] }>(
      '/v1/templates/partials',
      {
        method: 'GET',
        ...options,
      },
    );
  }

  /**
   * Create or update a reusable template partial.
   */
  async upsertPartial(
    name: string,
    content: string,
    options?: RequestOptions,
  ): Promise<{ success: boolean; partial: TemplatePartialDto }> {
    return this.http.request<{ success: boolean; partial: TemplatePartialDto }>(
      '/v1/templates/partials',
      {
        method: 'POST',
        body: { name, content },
        ...options,
      },
    );
  }
}
