# Convey Docker & Container Deployment Guide

This guide details containerized deployment for **Convey**, providing production-grade configurations for both modular deployments (resources separate from services) and single-command local orchestration.

---

## 1. Containerization Architecture

Convey follows a decoupled, cloud-native container topology:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                     SHARED DOCKER BRIDGE NETWORK: convey-network        │
├───────────────────────────────────┬────────────────────────────────────┤
│ 🗄️ STATEFUL RESOURCES LAYER       │ ⚡ STATELESS SERVICE LAYER         │
│ (docker-compose.resources.yml)    │ (docker-compose.service.yml)       │
│                                   │                                    │
│ ┌───────────────────────────────┐ │ ┌────────────────────────────────┐ │
│ │ postgres (PostgreSQL 16)      │ │ │ convey-server (Bun 1.4 API +   │ │
│ │ • Monthly Partitioned Ledger  │◄┼─┼─│   Outbox Relay & Workers)    │ │
│ │ • Port: 5432                  │ │ │ • Port: 3000                   │ │
│ └───────────────────────────────┘ │ └────────────────────────────────┘ │
│                                   │                 ▲                  │
│ ┌───────────────────────────────┐ │                 │                  │
│ │ redis (Redis 7 AOF)           │ │ ┌───────────────┴────────────────┐ │
│ │ • BullMQ Queues & Fast Locks  │◄┼─┤ convey-web (React 19 Console)  │ │
│ │ • Port: 6379                  │ │ │ • Port: 5173                   │ │
│ └───────────────────────────────┘ │ └────────────────────────────────┘ │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Option A: Modular Dual Compose (Recommended for Production / Cloud)

Deploying resources independently allows you to manage lifecycle, backups, and restarts of PostgreSQL and Redis without affecting or redeploying the application service layer.

### Step 1: Start Infrastructure Resources

```bash
# Start PostgreSQL 16 and Redis 7 in the background
docker compose -f docker-compose.resources.yml up -d
```

Verify resource health:
```bash
# Check container status and healthchecks
docker compose -f docker-compose.resources.yml ps
```

### Step 2: Start Convey Services

Once the resources are healthy, launch the Convey API Server and Mission Control Console:

```bash
# Start Convey server and Web UI
docker compose -f docker-compose.service.yml up -d
```

Check logs and status:
```bash
# View real-time server logs
docker compose -f docker-compose.service.yml logs -f convey-server
```

---

## 3. Option B: Unified Single-Command Deployment

For rapid local testing and single-node evaluation:

```bash
# Start all resources and services together
docker compose up -d
```

To stop all containers and preserve data volumes:
```bash
docker compose down
```

To stop and remove all volumes:
```bash
docker compose down -v
```

---

## 4. Automatic Database Migrations & Partition Setup

The container entrypoint (`docker-entrypoint.sh`) checks the `AUTO_MIGRATE` environment variable (defaults to `true`). 

On container startup, it automatically:
1. Executes all canonical SQL migrations in `apps/server/src/db/migrations/`.
2. Verifies and creates monthly range partitions (`past 3 months to next 6 months`).
3. Bootstraps the Elysia HTTP server and outbox workers.

To run migrations manually at any time:
```bash
docker compose -f docker-compose.service.yml run --rm convey-server bun apps/server/src/db/migrate.ts
```

---

## 5. Building Docker Images Manually

You can build specific multi-stage targets directly with Docker:

```bash
# Build Convey Server image
docker build -t convey-server:latest --target server .

# Build Convey Web Mission Control image
docker build -t convey-web:latest --target web .
```

---

## 6. Healthchecks & Verification

| Service | Port | Healthcheck Endpoint / Command |
| :--- | :--- | :--- |
| **Convey Server API** | `3000` | `GET http://localhost:3000/health/liveness` |
| **Convey Readiness Probe** | `3000` | `GET http://localhost:3000/health/readiness` |
| **Prometheus Telemetry** | `3000` | `GET http://localhost:3000/metrics` |
| **Swagger OpenAPI Docs** | `3000` | `http://localhost:3000/swagger` |
| **Mission Control Console** | `5173` | `http://localhost:5173` |
| **PostgreSQL** | `5432` | `pg_isready -U convey -d db-convey` |
| **Redis** | `6379` | `redis-cli ping` |

```bash
# Verify API readiness
curl -s http://localhost:3000/health/readiness | jq .
```
