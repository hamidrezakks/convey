-- Migration: 0005_provider_routes
-- Canonical schema for provider_routes

CREATE TABLE IF NOT EXISTS provider_routes (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  primary_provider_id TEXT NOT NULL,
  secondary_provider_id TEXT,
  priority INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_match ON provider_routes (team, category, country, channel);
