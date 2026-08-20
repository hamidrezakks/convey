-- Migration: 0006_policies
-- Canonical schema for rate_limit_policies, budget_policies, and budget_usage

CREATE TABLE IF NOT EXISTS rate_limit_policies (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  category TEXT,
  country TEXT,
  channel TEXT,
  window_seconds INT NOT NULL DEFAULT 60,
  max_requests INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_team ON rate_limit_policies (team);

CREATE TABLE IF NOT EXISTS budget_policies (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL UNIQUE,
  monthly_budget_usd NUMERIC(12, 4) NOT NULL,
  hard_stop TEXT NOT NULL DEFAULT 'true',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_policies_team ON budget_policies (team);

CREATE TABLE IF NOT EXISTS budget_usage (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  month TEXT NOT NULL,
  used_usd NUMERIC(12, 4) NOT NULL DEFAULT '0.0000',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_usage_policy_month ON budget_usage (policy_id, month);
