# Convey Zero-Trust Security Specification & Threat Model

Convey enforces a **Zero-Trust Security Architecture** across ingestion, storage, worker execution, and telemetry. Sensitive contact details, message contents, and vendor credentials are protected both in transit and at rest using cryptographic envelope encryption.

---

## 1. Zero-Trust Envelope Encryption at Rest (`PayloadEncryptionManager`)

In traditional architectures, databases store unencrypted recipient PII (emails, phone numbers, WhatsApp contacts, push tokens) and message body texts in plain SQL columns. A compromised database read replica or SQL injection exposes full customer communications.

Convey eliminates this vulnerability with **Field-Level AES-256-GCM Envelope Encryption**:

```text
[Incoming POST /v1/messages]
             │
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PayloadEncryptionManager.encrypt()                                       │
│ 1. Packs `recipients` and `channels` into a normalized JSON structure    │
│ 2. Generates a unique 96-bit cryptographically secure IV (crypto.random) │
│ 3. Encrypts payload with AES-256-GCM producing ciphertext + 128-bit tag  │
│ 4. Assigns envelope to metadata._encryptedEnvelope                       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL Partitioned messages Table                                    │
│ • Plaintext recipients & channel contents are NEVER written to disk      │
│ • Stored strictly as AES-256-GCM ciphertext + IV + Auth Tag             │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼ (Job Pulled by BullMQ Worker)
┌──────────────────────────────────────────────────────────────────────────┐
│ BullMQ Worker In-Memory Decryption                                       │
│ • Decrypted strictly in worker process heap memory during provider send │
│ • Dispatched directly to upstream provider over TLS 1.3                  │
│ • Memory is immediately garbage collected; zero plaintext persisted     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Encrypted Envelope Schema
Stored inside PostgreSQL `messages.metadata._encryptedEnvelope`:
```json
{
  "_encryptedEnvelope": {
    "version": 1,
    "algorithm": "aes-256-gcm",
    "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
    "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "ciphertext": "e4f8a91079d8f76e5d9c8b7a6f5e4d3c2b1a0987654321fedcba9876543210..."
  }
}
```

---

## 2. Sensitive Data Loss Prevention (DLP) Scanner

Convey includes a high-performance **DLP Scanner** (`src/utils/dlp-scanner.ts`) executed during request validation:

- **Credit Card / Payment Card Numbers (PAN)**: Scans Visa, MasterCard, American Express, and Discover formats; applies Luhn checksum validation.
- **Social Security Numbers (SSN)**: Detects and masks `XXX-XX-XXXX` formats.
- **API Keys & Bearer Secrets**: Detects AWS keys, OpenAI keys, SendGrid tokens, and private SSH keys.
- **Automatic Redaction**: Detected sensitive strings are masked (e.g. `4111-XXXX-XXXX-1111`) before reaching database ledgers or logs.

---

## 3. Authentication, Authorization & Tenant Scoping

### API Key Authentication
- All REST requests require a Bearer token: `Authorization: Bearer <api_key>`.
- Raw API keys are never stored in the database. Convey computes a SHA-256 hash of incoming tokens and validates against `api_keys.key_hash`.

### Multi-Tenant Boundary Isolation
- Every database query, Redis cache key (`convey:idempotency:{team}:...`), rate-limiting bucket, and DLQ filter is strictly scoped by `team`.
- Cross-tenant data leakage is cryptographically and logically impossible.

### Inbound Webhook Signature Verification
All provider webhook ingestion endpoints (`POST /v1/webhooks/:provider`) enforce cryptographic signature verification:
- **AWS SNS / SES**: Verifies AWS SigV4 certificates against official Amazon AWS domains.
- **SendGrid**: Verifies ECDSA public key signature headers.
- **Resend**: Verifies Svix HMAC-SHA256 timestamp and signature.
- **Mailgun / Twilio / Telnyx**: Verifies HMAC-SHA256 / Ed25519 payload signatures.

---

## 4. Log Redaction & Secret Masking

Convey's structured JSON logger (`PinoLogger` in `src/utils/logger.ts`) is configured with strict automatic path redaction. The following fields are stripped before any log serialization:
- `credentials`, `password`, `token`, `secret`, `apiKey`, `authorization`
- `recipients`, `email`, `phone`, `whatsapp`, `fcmTokens`
- `_encryptedEnvelope.ciphertext`, `_encryptedEnvelope.authTag`

---

## 5. Regulatory Compliance Mapping

| Regulation | Requirement | Convey Implementation |
| :--- | :--- | :--- |
| **GDPR** | Article 32: Security of Processing & Encryption | Field-level AES-256-GCM envelope encryption at rest. |
| **GDPR** | Article 17: Right to Erasure ("Forgot to be Forgotten") | High-speed SHA-256 hashed suppression lists; monthly table partition dropping (`DROP TABLE messages_y2025m01`). |
| **HIPAA** | Technical Safeguards (§ 164.312(a)(2)(iv)) | Cryptographic protection of electronic Protected Health Information (ePHI) in transit and at rest. |
| **SOC 2 Type II** | Trust Services Criteria: Confidentiality & Integrity | Append-only immutable audit logs in range-partitioned `message_events` and `audit_logs`. |
| **CAN-SPAM / TCPA**| Consent & Unsubscribe Compliance | Instant suppression lookup on send path; automated bounce/complaint suppression syncing. |
