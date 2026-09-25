-- Durable holds prevent concurrent workers from spending the same remaining budget.
CREATE TABLE IF NOT EXISTS budget_reservations (
  id text PRIMARY KEY,
  message_id text NOT NULL,
  team text NOT NULL,
  channel text NOT NULL,
  provider_id text NOT NULL,
  policy_id text,
  month text NOT NULL,
  currency text NOT NULL,
  policy_currency text NOT NULL,
  amount_usd numeric(12,4) NOT NULL CHECK (amount_usd >= 0),
  amount_in_policy_currency numeric(12,4) NOT NULL CHECK (amount_in_policy_currency >= 0),
  exchange_rate numeric(16,8) NOT NULL,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'committed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_reservations_policy_month_state_idx
  ON budget_reservations (policy_id, month, state);
