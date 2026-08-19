-- Migration: 0016_audit_logs
-- Canonical schema for audit_logs with cryptographic chaining

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_created ON audit_logs (team, created_at);
