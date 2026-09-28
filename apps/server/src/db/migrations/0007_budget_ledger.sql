-- Migration: 0007_budget_ledger
-- Canonical schema for budget_ledger (Range Partitioned by created_at)

CREATE TABLE IF NOT EXISTS budget_ledger (
  id TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  team TEXT NOT NULL DEFAULT 'default',
  amount_usd NUMERIC(12, 4) NOT NULL DEFAULT '0.0000',
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(16, 8) NOT NULL DEFAULT '1.00000000',
  amount_in_policy_currency NUMERIC(12, 4) NOT NULL DEFAULT '0.0000',
  channel TEXT NOT NULL DEFAULT 'email',
  provider_id TEXT NOT NULL DEFAULT 'ses',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);


CREATE INDEX IF NOT EXISTS idx_budget_ledger_team_created ON budget_ledger (team, created_at);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_msg_created ON budget_ledger (message_id, created_at);
