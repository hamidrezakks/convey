# Convey Zero-Trust Security Specification

Convey implements a **Zero-Trust Security Model** to protect sensitive contact details and message payloads both in transit and at rest.

---

## 1. Zero-Trust Envelope Encryption at Rest (`PayloadEncryptionManager`)

To protect Personal Identifiable Information (PII) like recipient email addresses, phone numbers, WhatsApp numbers, and push tokens, as well as message contents (SMS body, email HTML, subject lines, template parameters):

1. Upon acceptance (`POST /v1/messages`), `PayloadEncryptionManager` (`src/utils/payload-encryption.ts`) packs `recipients` and `channels` into a normalized JSON payload.
2. The payload is encrypted using **AES-256-GCM** encryption with a unique 96-bit Initialization Vector (IV) and 128-bit authentication tag.
3. The encrypted ciphertext, IV, and auth tag are written to PostgreSQL inside `messages.metadata._encryptedEnvelope`.
4. Plaintext contact info and message contents are **never** stored in PostgreSQL storage tables.
5. BullMQ queue workers retrieve the record and decrypt the envelope in worker memory strictly during provider dispatch.

---

## 2. API Key Authentication & Multi-Tenant Boundary Scoping

- REST APIs require Bearer API key authentication (`Authorization: Bearer <api_key>`).
- API keys are hashed and validated against the `api_keys` table (`src/modules/auth/auth.middleware.ts`).
- Idempotency reservations, rate limiting, and reporting budgets are strictly scoped by team boundary (`team`).

---

## 3. Log Redaction & Secret Masking

- Pino logger configuration automatically strips sensitive fields (`credentials`, `password`, `token`, `secret`, `recipients`) before emitting log entries.
- Provider credential structures stored in `providers` table are encrypted before persistence.
