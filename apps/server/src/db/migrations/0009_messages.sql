-- Migration: 0009_messages
-- Canonical schema for messages (Range Partitioned by created_at)

CREATE TABLE IF NOT EXISTS messages (
  id TEXT NOT NULL,
  public_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  team TEXT NOT NULL,
  category TEXT NOT NULL,
  country VARCHAR(2) NOT NULL,
  campaign_id TEXT,
  state TEXT NOT NULL DEFAULT 'accepted',
  priority TEXT NOT NULL DEFAULT 'normal',
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  recipients JSONB NOT NULL,
  channels JSONB NOT NULL,
  fallback JSONB,
  metadata JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_public_id_created ON messages (public_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_team_created ON messages (team, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_state_created ON messages (state, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sandbox ON messages (team, is_sandbox, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_state_scheduled ON messages (state, scheduled_at) WHERE state = 'accepted';
