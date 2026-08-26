-- Migration: 0018_templates.sql
-- Description: Create templates, template_versions, and template_partials tables

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'transactional',
  default_locale TEXT NOT NULL DEFAULT 'en-US',
  published_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_templates_tenant_team_slug UNIQUE (tenant_id, team, slug)
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_team ON templates (tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_templates_public_id ON templates (public_id);

CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels JSONB NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  author TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_template_versions_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions (template_id);

CREATE TABLE IF NOT EXISTS template_partials (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_template_partials_tenant_team_name UNIQUE (tenant_id, team, name)
);

CREATE INDEX IF NOT EXISTS idx_template_partials_tenant_team ON template_partials (tenant_id, team);
