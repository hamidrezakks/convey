-- Migration: 0002_api_keys
-- Canonical schema for api_keys

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT 'default',
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_team ON api_keys (tenant_id, team);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_hash ON api_keys (key_hash) WHERE active = TRUE;
