CREATE TABLE IF NOT EXISTS budget_reconciliations (
  reservation_id text PRIMARY KEY REFERENCES budget_reservations(id),
  team text NOT NULL,
  actor_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('committed', 'released')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_reconciliation_team_created ON budget_reconciliations(team, created_at);
