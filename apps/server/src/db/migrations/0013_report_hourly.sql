-- Migration: 0013_report_hourly
-- Canonical schema for report_hourly

CREATE TABLE IF NOT EXISTS report_hourly (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  hour TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  opened_count INT NOT NULL DEFAULT 0,
  read_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_hourly_lookup ON report_hourly (team, hour, channel);
