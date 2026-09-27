-- Migration: 0008_suppressions
-- Canonical schema for suppressions

CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  recipient TEXT,
  target_type TEXT NOT NULL DEFAULT 'recipient',
  identifier_type TEXT NOT NULL DEFAULT 'email',
  identifier_hash TEXT NOT NULL DEFAULT '',
  team TEXT NOT NULL DEFAULT 'default',
  category TEXT,
  country TEXT,
  channel TEXT,
  reason TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppressions_lookup ON suppressions (team, identifier_hash, channel);
CREATE INDEX IF NOT EXISTS idx_suppressions_team_created ON suppressions (team, created_at);
