-- Migration: 0012_outbox
-- Canonical schema for outbox

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  shard_id INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending_relay ON outbox (state, available_at) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_processed_cutoff ON outbox (state, processed_at);
