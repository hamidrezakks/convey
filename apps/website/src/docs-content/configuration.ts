import type { DocSection } from './quickstart';

export const configurationDoc: DocSection = {
  id: 'configuration',
  title: 'Environment & Configuration Reference',
  description:
    'Complete reference for environment variables, database connections, Redis clusters, BullMQ concurrency, and encryption key rotation.',
  headings: [
    { id: 'env-reference', title: 'Environment Variables Reference (.env)', level: 2 },
    { id: 'database-config', title: 'Database & Connection Pooling', level: 2 },
    { id: 'redis-queues', title: 'Redis & BullMQ Queue Configuration', level: 2 },
    { id: 'encryption-keys', title: 'AES-256-GCM Encryption Key Management', level: 2 },
    { id: 'drr-tuning', title: 'DRR Multi-Tenant Quantum Tuning', level: 2 },
  ],
  content: `
## Environment Variables Reference (.env)

Convey is configured via standard environment variables. The table below lists all supported keys, default values, and operational descriptions:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **\`PORT\`** | Integer | \`3000\` | HTTP server listening port for Elysia.js core API |
| **\`HOST\`** | String | \`0.0.0.0\` | Network interface binding host |
| **\`NODE_ENV\`** | String | \`development\` | Environment mode: \`development\`, \`production\`, \`test\` |
| **\`DATABASE_URL\`** | String | \`postgres://...\` | PostgreSQL connection URI with pool size parameters |
| **\`DATABASE_POOL_SIZE\`** | Integer | \`20\` | Maximum database connection pool capacity |
| **\`REDIS_URL\`** | String | \`redis://localhost:6379\` | Redis connection URI for idempotency, L1 cache, and queues |
| **\`CONVEY_ENCRYPTION_KEY\`** | Hex (64 chars) | *Generated* | Primary 256-bit AES-GCM master encryption key for PII |
| **\`BULLMQ_CONCURRENCY\`** | Integer | \`25\` | Number of parallel message dispatches per worker instance |
| **\`OUTBOX_POLL_INTERVAL_MS\`** | Integer | \`100\` | Polling interval for \`SKIP LOCKED\` outbox relay loop |
| **\`OUTBOX_BATCH_SIZE\`** | Integer | \`100\` | Number of rows fetched per outbox polling transaction |
| **\`DRR_QUANTUM_ENTERPRISE\`** | Integer | \`200\` | Deficit Round Robin queue quantum for Enterprise tenants |
| **\`DRR_QUANTUM_PRO\`** | Integer | \`50\` | Deficit Round Robin queue quantum for Pro tenants |
| **\`DRR_QUANTUM_FREE\`** | Integer | \`10\` | Deficit Round Robin queue quantum for Free tenants |
| **\`CIRCUIT_BREAKER_FAILURE_THRESHOLD\`**| Float | \`0.50\` | Error rate threshold (50%) to trip provider circuit to OPEN |
| **\`LOG_LEVEL\`** | String | \`info\` | Structured logging level: \`trace\`, \`debug\`, \`info\`, \`warn\`, \`error\` |

---

## Database & Connection Pooling

Convey uses **PostgreSQL 16** with Drizzle ORM. For high-throughput production deployments, configure your \`DATABASE_URL\` with connection pool parameters:

\`\`\`bash
DATABASE_URL="postgres://convey:convey_secure_pass@postgres-cluster.internal:5432/convey_prod?sslmode=require&max_connections=50"
\`\`\`

### Migration & Partition Scripts
\`\`\`bash
# Generate SQL migration files based on schema changes
bun run db:generate

# Apply pending migrations and initialize monthly partitions
bun run db:migrate

# Seed database with 1,000,000 synthetic stress testing records
bun run db:seed:million
\`\`\`

---

## Redis & BullMQ Queue Configuration

Redis is utilized as a dual-purpose engine:
1. **1-RTT Fast-Path Idempotency**: Atomic \`SET key value EX 86400 NX\` lease reservation.
2. **BullMQ Work Queues**: Reliable job dispatching with exponential full-jitter retries.

\`\`\`bash
REDIS_URL="redis://:auth_token@redis-cluster.internal:6379/0"
\`\`\`

---

## AES-256-GCM Encryption Key Management

Convey uses transparent **AES-256-GCM field-level envelope encryption** for all PII data stored at rest.

### 1. Generating a Production Master Key
Generate a cryptographically secure 256-bit (32-byte) hex string:

\`\`\`bash
openssl rand -hex 32
# Example output: 9f8a3c1e2b4d5e6f8a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f
\`\`\`

### 2. Key Rotation Runbook
Convey supports zero-downtime key rotation:
1. Append the new key to \`CONVEY_ENCRYPTION_KEY_SECONDARY\` in your secrets manager.
2. Update \`CONVEY_ENCRYPTION_KEY\` with the new key version (e.g. \`version = 2\`).
3. Outbox workers automatically decrypt existing records using version-aware key rings and re-encrypt updated rows with the latest master key.

---

## DRR Multi-Tenant Quantum Tuning

Convey allows real-time tuning of Deficit Round Robin weights:

\`\`\`bash
# Double enterprise throughput during holiday traffic peaks
DRR_QUANTUM_ENTERPRISE=400
DRR_QUANTUM_PRO=100
DRR_QUANTUM_FREE=10
\`\`\`
`,
};
