# Payload key management

Production requires a unique random `PAYLOAD_ENCRYPTION_KEY` of at least 32 characters. Store it in a secret manager; the development default is prohibited in production. Mock KMS is test-only and must never be registered in production.

For rotation, supply `PAYLOAD_ENCRYPTION_KEYS` as a JSON object mapping positive integer versions to secrets, and `PAYLOAD_ENCRYPTION_KEY_VERSION` as the active version. Version 1 must retain the original secret. Deploy the complete ring to every process before switching the active version. Retain old keys until their ciphertext and backups have expired. Unknown versions fail closed. The in-process rotation API requires a distinct secret and increasing version; persist the same ring in deployment configuration before using it.

Recipient revocation is **logical access revocation**, not cryptographic erasure. The durable PostgreSQL tombstone is checked before each recipient decryption. Read failures deny decryption; write failures prevent reporting successful revocation. Tombstones have no TTL and must be included in backups and disaster recovery. Redis notifications only accelerate local cache invalidation.

HKDF keys remain derivable by someone holding the root secret. Message routing fields and historical backups can contain recipient data. Physical erasure requires a separately audited retention/deletion process covering those records and backups; this API does not claim to provide it. Existing recipient identifiers retain their legacy scope for compatibility.
