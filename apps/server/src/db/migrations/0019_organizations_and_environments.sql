-- Migration: 0019_organizations_and_environments.sql
-- Description: Create organizations, projects, environments, and user_roles tables

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'PRO',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_projects_org_slug UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS environments (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'production',
  api_key_prefix TEXT NOT NULL DEFAULT 'convey_live_',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_environments_project_type UNIQUE (project_id, type)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user ON user_roles (tenant_id, user_id);
