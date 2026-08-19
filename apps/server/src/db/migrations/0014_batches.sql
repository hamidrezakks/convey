-- Migration: 0014_batches
-- Canonical schema for batches

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team TEXT NOT NULL,
  total_count INT NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  metadata JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_tenant_team ON batches (tenant_id, team);
