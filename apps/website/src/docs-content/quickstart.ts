export interface DocSection {
  id: string;
  title: string;
  description: string;
  content: string;
  headings: { id: string; title: string; level: number }[];
}

export const quickstartDoc: DocSection = {
  id: 'quickstart',
  title: 'Quickstart & Installation',
  description: 'Get Convey running locally in under 2 minutes with Bun 1.4, PostgreSQL 16, and Redis 7.',
  headings: [
    { id: 'prerequisites', title: 'System Prerequisites', level: 2 },
    { id: 'step-1-clone', title: '1. Clone & Install Dependencies', level: 2 },
    { id: 'step-2-env', title: '2. Configure Environment', level: 2 },
    { id: 'step-3-db', title: '3. Run Database Migrations', level: 2 },
    { id: 'step-4-dev', title: '4. Start Development Cluster', level: 2 },
    { id: 'docker-fast-track', title: 'Docker 1-Command Fast Track', level: 2 },
    { id: 'service-endpoints', title: 'Service Ports & Endpoints Map', level: 2 },
    { id: 'next-steps', title: 'Next Steps', level: 2 },
  ],
  content: `
## System Prerequisites

Convey is engineered natively for **Bun 1.4+** to achieve sub-millisecond execution times and eliminate Node.js runtime overhead.

| Component | Minimum Version | Recommended Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Bun** | \`>= 1.1.0\` | \`Bun 1.4+\` | Native runtime, test runner, package manager |
| **PostgreSQL** | \`>= 15.0\` | \`PostgreSQL 16\` | Range-partitioned message ledger & outbox |
| **Redis** | \`>= 7.0\` | \`Redis 7.2+\` | Fast-path idempotency, BullMQ queues, L1 cache |
| **Node.js** | Optional | Not required | Convey runs 100% standalone on Bun |

---

## 1. Clone & Install Dependencies

Clone the official repository and use Bun to install workspace packages across the monorepo in milliseconds:

\`\`\`bash
# Clone the repository
git clone https://github.com/convey/convey.git
cd convey

# Install dependencies across monorepo workspace (server, web, website, shared)
bun install
\`\`\`

---

## 2. Configure Environment

Copy the example environment configuration to initialize local database connection strings, encryption secrets, and worker concurrency parameters:

\`\`\`bash
cp .env.example .env
\`\`\`

> **Note on Encryption Key**: For development, the default 256-bit key in \`.env.example\` works out of the box. For production, generate a cryptographically secure 64-hex-character string with \`openssl rand -hex 32\`.

---

## 3. Run Database Migrations

Convey uses **Drizzle ORM** with automated monthly PostgreSQL range-partitioning:

\`\`\`bash
# Execute Drizzle schema migrations & auto-generate monthly partition tables
bun run db:migrate
\`\`\`

This creates the base tables (\`messages\`, \`outbox\`, \`message_attempts\`, \`suppressions\`, \`policies\`) along with range-partitioned tables for the current and upcoming months.

---

## 4. Start Development Cluster

Launch all monorepo applications concurrently with hot-reloading:

\`\`\`bash
bun run dev
\`\`\`

This starts:
- 🚀 **Convey Elysia.js Core API Engine** on \`http://localhost:3000\`
- 🎛️ **Staff-Level Mission Control Web UI** on \`http://localhost:5173\`
- 🌐 **Developer Portal & Documentation** on \`http://localhost:5174\`
- ⚙️ **BullMQ Outbox Relay & Dispatch Workers** in background worker threads

---

## Docker 1-Command Fast Track

If you prefer to run the complete stack including stateful PostgreSQL 16 and Redis 7 without local database installations:

\`\`\`bash
# Start PostgreSQL 16, Redis 7, Convey Core API, and Mission Control Console
docker compose up -d
\`\`\`

To start stateful infrastructure resources separately:

\`\`\`bash
# Start Postgres & Redis only
docker compose -f docker-compose.resources.yml up -d

# Start Convey services (runs migrations automatically)
docker compose -f docker-compose.service.yml up -d
\`\`\`

---

## Service Ports & Endpoints Map

Once running, the following endpoints are available:

| Port / URL | Service Name | Description |
| :--- | :--- | :--- |
| **\`http://localhost:5174\`** | **Developer Portal** | Interactive documentation, architectural visualizer, API sandbox |
| **\`http://localhost:5173\`** | **Mission Control UI** | Staff-level telemetry, live circuit breaker cockpit, W3C trace waterfall |
| **\`http://localhost:3000\`** | **Convey Core API** | High-throughput message ingestion and webhook ingestion gateway |
| **\`http://localhost:3000/swagger\`** | **OpenAPI Spec** | Interactive OpenAPI 3.1 Swagger documentation |
| **\`http://localhost:3000/health/readiness\`** | **Kubernetes Probes** | Deep health checks (PostgreSQL connectivity, Redis ping, worker health) |
| **\`http://localhost:3000/metrics\`** | **Prometheus Metrics** | Real-time RPS, p95 latency histograms, queue depths |

---

## Next Steps

Now that Convey is running locally:
- Learn about the [Transactional Outbox & Range Partitioning Architecture](/docs/architecture)
- Explore the [REST API Reference & Multi-Language SDKs](/docs/api-reference)
- Configure your first [Email, SMS, or WhatsApp Provider](/docs/providers)
`,
};
