-- Migration: 0010_message_attempts
-- Canonical schema for message_attempts (Range Partitioned by created_at)

CREATE TABLE IF NOT EXISTS message_attempts (
  id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  recipient_index INT NOT NULL DEFAULT 0,
  attempt_no INT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'initial',
  state TEXT NOT NULL,
  provider_message_id TEXT,
  error_category TEXT,
  error_code TEXT,
  error_message TEXT,
  provider_metadata JSONB,
  queued_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  provider_accepted_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  latency_ms INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_attempts_msg_created ON message_attempts (message_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_provider_msg ON message_attempts (provider_id, provider_message_id);
