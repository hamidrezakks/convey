CREATE TABLE IF NOT EXISTS webhook_event_receipts (
  id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
