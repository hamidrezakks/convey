CREATE INDEX IF NOT EXISTS idx_outbox_processing_lease ON outbox (locked_at) WHERE state = 'processing';
