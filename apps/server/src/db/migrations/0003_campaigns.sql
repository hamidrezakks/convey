-- Migration: 0003_campaigns
-- Canonical schema for campaigns

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  external_id TEXT,
  team TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  paused_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_team ON campaigns (tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_campaigns_state ON campaigns (state);
