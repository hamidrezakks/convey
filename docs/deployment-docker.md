# Convey Docker & Container Deployment Guide

This guide details containerized deployment for **Convey**, providing production-grade configurations for modular deployments, single-command local orchestration, and discrete provider mock simulation.

---

## 1. Containerization Architecture

Convey follows a decoupled, cloud-native container topology:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     SHARED DOCKER BRIDGE NETWORK: convey-network                        │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│ 🗄️ STATEFUL RESOURCES LAYER       │ ⚡ STATELESS SERVICE & MOCK SIMULATOR LAYER        │
│ (docker-compose.resources.yml)    │ (docker-compose.service.yml & providers.yml)       │
│                                   │                                                    │
│ ┌───────────────────────────────┐ │ ┌────────────────────────────────────────────────┐ │
│ │ postgres (PostgreSQL 18)      │ │ │ convey-server (Bun 1.4 API + Workers)          │ │
│ │ • Monthly Partitioned Ledger  │◄┼─┼─│ • Port: 3000                                 │ │
│ │ • Port: 5432                  │ │ └────────────────────────────────────────────────┘ │
│ └───────────────────────────────┘ │                 ▲                 ▲                │
│                                   │                 │                 │ Outbound HTTP  │
│ ┌───────────────────────────────┐ │ ┌───────────────┴────────┐ ┌──────┴──────────────┐ │
│ │ redis (DragonflyDB)           │ │ │ convey-web             │ │ mock-providers      │ │
│ │ • BullMQ Queues & Fast Locks  │◄┼─┤ (React 19 Console)     │ │ (Discrete/Gateway)  │ │
│ │ • Port: 6379                  │ │ │ • Port: 5173           │ │ • Ports: 4000-4018  │ │
│ └───────────────────────────────┘ │ └────────────────────────┘ └─────────────────────┘ │
└───────────────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Option A: Modular Dual Compose (Recommended for Production / Cloud)

Deploying resources independently allows you to manage lifecycle, backups, and restarts of PostgreSQL and Redis without affecting or redeploying the application service layer.

### Step 1: Start Infrastructure Resources

```bash
# Start PostgreSQL 18 and DragonflyDB in the background
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

For rapid local testing and single-node evaluation with universal mock provider simulation:

```bash
# Start all resources, services, and mock gateway together
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

## 4. Option C: Discrete Multi-Container Provider Simulation Topology

To run each third-party communication provider in its own isolated Docker container (with official domain aliases such as `api.resend.com`, `api.twilio.com`, `slack.com`, `fcm.googleapis.com`, `events.pagerduty.com`):

```bash
# Start all services with discrete provider containers
docker compose -f docker-compose.yml -f docker-compose.providers.yml up -d
```

### Viewing Discrete Provider Container Logs Live:
```bash
# View Resend Email logs
docker compose -f docker-compose.providers.yml logs -f mock-resend

# View Twilio SMS logs
docker compose -f docker-compose.providers.yml logs -f mock-twilio

# View Slack Chat logs
docker compose -f docker-compose.providers.yml logs -f mock-slack

# View FCM Push logs
docker compose -f docker-compose.providers.yml logs -f mock-fcm

# View PagerDuty Tool logs
docker compose -f docker-compose.providers.yml logs -f mock-pagerduty
```

### Running Automated Production Verification:
```bash
# Executes automated multi-channel delivery validation with public ULID asserts and status polling
bun run test:prod:docker
```

---

## 5. Automatic Database Migrations & Partition Setup

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

## 6. Building Docker Images Manually

You can build specific multi-stage targets directly with Docker:

```bash
# Build Convey Server image
docker build -t convey-server:latest --target server .

# Build Convey Web Mission Control image
docker build -t convey-web:latest --target web .

# Build Convey Mock Server image
docker build -t convey-mock-server:latest --target mock-server .
```

---

## 7. Healthchecks & Verification

| Service | Port | Healthcheck Endpoint / Command |
| :--- | :--- | :--- |
| **Convey Server API** | `3000` | `GET http://localhost:3000/health/liveness` |
| **Convey Readiness Probe** | `3000` | `GET http://localhost:3000/health/readiness` |
| **Mock Provider Gateway** | `4000` | `GET http://localhost:4000/health` |
| **Discrete Mock Resend** | `4001` | `GET http://localhost:4001/health` |
| **Discrete Mock Twilio** | `4003` | `GET http://localhost:4003/health` |
| **Discrete Mock Slack** | `4004` | `GET http://localhost:4004/health` |
| **Discrete Mock FCM** | `4005` | `GET http://localhost:4005/health` |
| **Discrete Mock PagerDuty** | `4007` | `GET http://localhost:4007/health` |
| **Prometheus Telemetry** | `3000` | `GET http://localhost:3000/metrics` |
| **Swagger OpenAPI Docs** | `3000` | `http://localhost:3000/swagger` |
| **Mission Control Console** | `5173` | `http://localhost:5173` |
| **PostgreSQL 18** | `5432` | `pg_isready -U convey -d db-convey` |
| **DragonflyDB** | `6379` | `redis-cli ping` |
