-- Migration: 0011_message_events
-- Canonical schema for message_events (Range Partitioned by occurred_at)

CREATE TABLE IF NOT EXISTS message_events (
  id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  attempt_id TEXT,
  channel TEXT,
  provider_id TEXT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX IF NOT EXISTS idx_events_msg_occurred ON message_events (message_id, occurred_at);
