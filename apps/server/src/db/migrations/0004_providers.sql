-- Migration: 0004_providers
-- Canonical schema for providers

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  channel TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 1,
  weight INT NOT NULL DEFAULT 100,
  fallback_provider_id TEXT,
  credentials JSONB NOT NULL,
  config JSONB,
  rate_limit_per_sec INT DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_providers_channel_priority ON providers (channel, priority, enabled);
CREATE INDEX IF NOT EXISTS idx_providers_channel_enabled ON providers (channel, enabled);
