-- Migration: 0017_report_campaign_hourly
-- Pre-aggregated rollup tables and indexes for multi-tenant and campaign reporting



CREATE TABLE IF NOT EXISTS report_campaign_hourly (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  team TEXT NOT NULL,
  category TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_report_camp_hourly_camp_hour ON report_campaign_hourly (campaign_id, hour);
CREATE INDEX IF NOT EXISTS idx_report_camp_hourly_team_hour ON report_campaign_hourly (team, hour);
CREATE INDEX IF NOT EXISTS idx_report_camp_hourly_hour ON report_campaign_hourly (hour);
