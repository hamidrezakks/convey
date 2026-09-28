-- Durable logical revocations; no TTL. HKDF-derived keys are not physically erased.
CREATE TABLE IF NOT EXISTS recipient_revocations (
  recipient_id text PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
