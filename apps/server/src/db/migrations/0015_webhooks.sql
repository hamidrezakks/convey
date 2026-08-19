-- Migration: 0015_webhooks
-- Canonical schema for webhook_subscriptions and webhook_deliveries

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  team TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant_team ON webhook_subscriptions (tenant_id, team);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response_time_ms INT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub_created ON webhook_deliveries (subscription_id, created_at);
