-- Align canonical installations with the suppression fields used by the service.
-- Existing records retain their hash-based identity; plaintext cannot be recovered.
ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE suppressions ADD COLUMN IF NOT EXISTS recipient TEXT;
