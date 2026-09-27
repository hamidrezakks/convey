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
  cost_usd NUMERIC(12,4) NOT NULL DEFAULT '0.0000',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_hourly_lookup ON report_hourly (team, hour, channel);

CREATE INDEX IF NOT EXISTS idx_report_hourly_team_hour ON report_hourly (team, hour);
CREATE INDEX IF NOT EXISTS idx_report_hourly_category_hour ON report_hourly (category, hour);
CREATE INDEX IF NOT EXISTS idx_report_hourly_hour ON report_hourly (hour);
