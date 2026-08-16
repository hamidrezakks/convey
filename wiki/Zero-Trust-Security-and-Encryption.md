# Zero-Trust Security & Envelope Payload Encryption Guide

This guide provides a comprehensive architectural breakdown of Convey's **Zero-Trust Security Model**, field-level **AES-256-GCM envelope payload encryption**, and automated **Data Loss Prevention (DLP) sanitization**.

---

## 1. Zero-Trust Security Architecture

Convey adheres to the fundamental principle: **Never Trust, Always Encrypt, Strictly Isolate**.

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    POST /v1/messages                   │
                               │  { recipients: {...}, channels: {...}, metadata: {...} │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │             DLP Regex Scanner (DlpScanner)             │
                               │  • Scans PANs, SSNs, and Bearer Tokens                 │
                               │  • Redacts sensitive credentials from memory payloads  │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │       PayloadEncryptionManager (AES-256-GCM)           │
                               │  • Generates cryptographically secure 96-bit IV        │
                               │  • Encrypts `recipients` and `channels`                │
                               │  • Produces 128-bit authentication tag                 │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │              PostgreSQL Partitioned Table              │
                               │  INSERT INTO messages (metadata._encryptedEnvelope)    │
                               │  *Plaintext PII & content NEVER touch disk storage*    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼ (Pulled by BullMQ Worker)
                               ┌────────────────────────────────────────────────────────┐
                               │             In-Memory Worker Decryption                │
                               │  • Decrypted strictly in worker process heap memory    │
                               │  • Executed against provider adapter over TLS 1.3      │
                               │  • Garbage collected immediately after dispatch        │
                               └────────────────────────────────────────────────────────┘
```

---

## 2. Envelope Schema & Structure

Encrypted payloads reside inside `messages.metadata._encryptedEnvelope`:

```json
{
  "orderId": "10928",
  "_encryptedEnvelope": {
    "version": 1,
    "algorithm": "aes-256-gcm",
    "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
    "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "ciphertext": "e4f8a91079d8f76e5d9c8b7a6f5e4d3c2b1a0987654321fedcba9876543210..."
  }
}
```

- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode with built-in authenticated data integrity).
- **IV (Initialization Vector)**: 96-bit unique IV generated per message (`crypto.randomBytes(12)`).
- **Auth Tag**: 128-bit authentication tag ensuring ciphertext has not been tampered with.
- **Key Management**: Master key is securely provisioned via `CONVEY_ENCRYPTION_KEY` (256-bit hex string).

---

## 3. Data Loss Prevention (DLP) Scanner

The `DlpScanner` (`src/utils/dlp-scanner.ts`) inspects incoming payloads and automatically redacts:
- **Payment Card Numbers (PAN)**: Visa, Mastercard, Amex, Discover with Luhn verification.
- **Social Security Numbers (SSN)**: `XXX-XX-XXXX`.
- **API Keys & Secrets**: AWS, OpenAI, GitHub, and SendGrid bearer tokens.

---

## 4. Regulatory Compliance Matrix

| Regulation | Compliance Guarantee | Architectural Implementation |
| :--- | :--- | :--- |
| **GDPR** | Article 32: Cryptographic Data Protection | All contact PII and message content encrypted with AES-256-GCM at rest. |
| **GDPR** | Article 17: Right to Erasure | Suppression hashing (`suppressions` table) and zero-downtime monthly partition dropping (`DROP TABLE`). |
| **HIPAA** | Technical Safeguards (§ 164.312) | Electronic Protected Health Information (ePHI) encrypted in transit (TLS 1.3) and at rest. |
| **SOC 2 Type II**| Confidentiality & Auditability | Immutable append-only audit trail in range-partitioned `message_events`. |
