# Zero-Trust Security & Envelope Payload Encryption Guide

This guide provides an in-depth explanation of Convey's Zero-Trust Envelope Payload Encryption architecture (`PayloadEncryptionManager`).

---

## 1. Zero-Trust Security Principles

1. **No Plaintext PII at Rest**: Recipient email addresses, phone numbers, WhatsApp numbers, and push tokens are never written to PostgreSQL storage tables in plaintext.
2. **No Plaintext Message Content at Rest**: Message body texts, HTML contents, subject lines, and template variables are packed together with recipients before encryption.
3. **AES-256-GCM Envelope Standard**: Encrypted using AES-256-GCM with a unique 96-bit Initialization Vector (IV) and 128-bit authentication tag.
4. **In-Memory Decryption**: BullMQ queue workers retrieve `_encryptedEnvelope` from PostgreSQL `messages.metadata` and decrypt the contents strictly inside worker process memory during provider dispatch.

---

## 2. Encryption Envelope Structure

Stored inside `messages.metadata`:

```json
{
  "paymentId": "pay_89273",
  "_encryptedEnvelope": {
    "version": 1,
    "iv": "3f8a91c2b5d4e6f8a9b0c1d2",
    "authTag": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
    "ciphertext": "e4f8a91079d8f76e5d9c8b7a6f5e4d3c2b1a0987654321fedcba9876543210"
  }
}
```

---

## 3. Log Redaction & Key Management

- Master encryption key is configured via system environment variables.
- Pino structured logger automatically redacts `credentials`, `password`, `token`, `secret`, `recipients`, and `_encryptedEnvelope` fields to prevent sensitive data exposure in log aggregation tools (Datadog, Loki, CloudWatch).
