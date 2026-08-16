# 🎛️ Convey Web-UI Mission Control & Telemetry Console

The **Convey Web-UI** (`@convey/web`) is an enterprise-grade administration and planetary observability console engineered for high-throughput, multi-tenant communication infrastructure.

Built with **React 19**, **Base UI** (`@base-ui-components/react`), **Tailwind CSS**, **Recharts**, **Lucide Icons**, and **Sonner**, it provides real-time telemetry, distributed trace inspection, circuit breaker overrides, dry-run DLQ blast radius simulations, and omnichannel template authoring.

---

## 🏛️ Monorepo Architecture Overview

Convey is structured as a high-performance **Bun Workspace Monorepo**:

```text
convey/
├── apps/
│   ├── server/               # @convey/server: High-Throughput Elysia API & BullMQ Workers
│   │   ├── src/
│   │   │   ├── modules/admin/ # Admin REST & Telemetry Control Plane APIs
│   │   │   ├── modules/messaging/
│   │   │   ├── modules/providers/ # 88 Provider Adapters
│   │   │   └── ...
│   │   └── tests/            # 886 Server Tests & 10k Load Benchmarks
│   │
│   └── web/                  # @convey/web: React 19 + Base UI Mission Control Console
│       ├── src/
│       │   ├── components/ui/       # Base UI + Tailwind Obsidian Design Tokens
│       │   ├── components/layout/   # Sidebar, Navbar, ⌘K Command Palette
│       │   ├── components/trace/    # W3C Distributed Trace Waterfall Visualizer
│       │   ├── components/composer/ # Omnichannel Device Frame Previews
│       │   ├── pages/               # 10 Mission Control Views
│       │   └── lib/api.ts           # Type-safe Admin API client
│       └── tests/            # Happy-DOM Component & Integration Test Suite
│
└── packages/
    └── shared/               # @convey/shared: Universal Domain Types, Enums & Contracts
        ├── src/index.ts      # Channel, MessageStatus, CircuitState, TraceSpan, DTOs
        └── package.json
```

---

## 🚀 Quickstart & Operations

### 1. Launch Full Monorepo in Development
```bash
# Runs @convey/server on port 3000 and @convey/web on port 5173 concurrently
bun run dev
```
Access the console at: **`http://localhost:5173`**.

### 2. Run Only Backend Server
```bash
bun run dev:server
```

### 3. Run Only Web-UI
```bash
bun run dev:web
```

### 4. Run Web Test Suite
```bash
bun run test:web
```

### 5. Build Web Production Bundle
```bash
bun --filter @convey/web build
```

---

## 🖥️ Feature Walkthrough: The 10 Mission Control Centers

### 1. Planetary Telemetry & Ops Center (`OverviewPage`)
- **Real-Time Throughput (RPS)** and **P95 Latency Sparkline**: Continuous 1.5-second live telemetry window with sliding ticks.
- **BullMQ Queue Depths**: Live queue saturation monitoring across `outbox-relay`, `message-dispatch`, `provider-send`, `scheduled-promoter`, and `customer-webhook-dispatch`.
- **V8 Heap Memory Guard**: Real-time RSS and V8 Heap saturation gauge enforcing $< 85\%$ threshold.
- **Subsystems Resilience Matrix**: Health states of PostgreSQL pool, Redis token bucket cluster, and active monthly partition table (`messages_y2026m08`).
- **Live Event Stream Ticker**: SSE real-time stream of message acceptances, outbox flushes, and provider sends.

### 2. Universal Message Explorer & Distributed Tracing (`MessagesPage`)
- **High-Performance Filter Grid**: Search by Public ID (`msg_<ULID>`), recipient phone/email, tenant ID, channel, and status.
- **W3C Distributed Trace Waterfall (`TraceWaterfall`)**: Gantt visualizer detailing span duration across:
  - `http.ingest_acceptance` (Convey API)
  - `outbox.db_transaction` (PostgreSQL)
  - `worker.outbox_relay` (Relay Worker)
  - `scheduler.drr_quantum` (DRR Scheduler)
  - `router.predictive_cost_scorecard` (Smart Router)
  - `provider.<id>.wire_send` (Wire Provider Send)
  - `webhook.dlr_receipt_ingestion` (Webhook Ingestion)
- **Zero-Trust Encryption Badge**: Validates AES-256-GCM envelope encryption and KMS key ID for customer PII protection.
- **Delivery Attempts Ledger**: Detailed history of all HTTP codes, error messages, and provider latencies.

### 3. Provider Matrix & Circuit Breaker Cockpit (`ProvidersPage`)
- **80+ Provider Capability Matrix**: Instant view of all Email, SMS, WhatsApp, Push, Slack, and Tool adapters.
- **Circuit Breaker Controls**: Real-time circuit toggles (`CLOSED`, `HALF-OPEN`, `OPEN`).
- **Stepped Half-Open Traffic Ramp**: Slider to admit gradual probe traffic (5% ➔ 20% ➔ 50% ➔ 100%) during provider recovery.
- **Synthetic Canary Probes**: 1-click autonomous canary probing to verify provider recovery without customer traffic risk.
- **EMA Latency & Anomaly Scorecard**: Real-time Exponential Moving Average latency and Z-score anomaly detector.

### 4. Provider Registration & Environment Setup Studio (`ProviderConfigPage` / `/providers/configure`)
- **88+ Turnkey Provider Catalog**: Browse and register adapters across Email (SendGrid, Resend, AWS SES, Postmark), SMS (Twilio, Telnyx, Sinch, Infobip), WhatsApp (Meta Cloud API), Push (FCM, APNs), Slack, Discord, and Webhooks.
- **Dynamic Credential Setup Wizard**: Guided modal with automatic validation of required API keys, account tokens, sender signatures, and regions.
- **Multi-Tier Routing & Fallback Chains**: Configure routing priority (Tier #1 to #5), traffic load share weights (10% to 100%), and automatic failover targets.
- **Live Connection Test Probes**: Test live authentication against provider endpoints with instant latency feedback before saving.
- **Unified Environment Variable Vault (`.env`)**: Auto-generated, unified `.env` vault with 1-click clipboard copy and direct file download (`.env.convey`).
- **AES-256-GCM Vault Security**: All stored credentials are protected at rest via zero-trust envelope encryption.

### 5. Dead-Letter Queue (DLQ) & Dry-Run Blast-Radius Simulator (`DlqPage`)
- **Failure Cluster Categorization**: Automatically groups failed messages by error category (`PROVIDER_5XX`, `RATE_LIMIT_429`, `TIMEOUT_504`, `AUTH_EXPIRED_401`, `INVALID_RECIPIENT_400`, `POLICY_BLOCKED`).
- **Dry-Run Blast-Radius Simulator**: Predicts success rate %, estimated provider bill, execution duration, and tenant risk level before executing live replays.
- **Zero-Data-Loss Batch Replay**: Live batch replay with progress tracking and confetti feedback.

### 5. Deliverability Autopilot & Suppression Guard (`DeliverabilityPage`)
- **Domain Deliverability Scorecard**: Instant verification of SPF, DKIM 2048-bit rotation, DMARC `p=reject`, and IP warmup progression.
- **Suppression Management**: Table of active suppressions with search by domain or handle.
- **1-Click Manual Add & Unblock**: Add manual suppression rules or instantly unblock recipients.

### 6. DRR Multi-Tenant Scheduler & Policy Studio (`PoliciesPage`)
- **Deficit Weighted Round Robin (DRR) Weights**: Configurable scheduler quanta for `Enterprise` (200), `Pro` (50), and `Free` (10) tiers to prevent noisy-neighbor starvation.
- **Distributed Token Bucket Ingress**: Configure refill rates and burst capacities per tenant.
- **WhatsApp 24h Session Cost Optimizer**: Automatic zero-cost plain text conversion toggle.
- **Regional Quiet Hours Autopilot**: Configure quiet hours by recipient timezone (EMEA / APAC / US).

### 7. Omnichannel Composer & Live Sandbox (`ComposerPage`)
- **Interactive Multi-Channel Frames**: Side-by-side WYSIWYG editor with realistic live frames:
  - **Email**: Responsive HTML preview with Desktop (580px) and Mobile (360px) viewports.
  - **SMS**: Live GSM-7 vs UCS-2 character counter and SMS segment calculator (`142 / 160 chars, 1 segment`).
  - **WhatsApp**: Verified business header, chat bubble, and interactive quick-reply CTA buttons.
  - **Slack**: Block Kit interactive preview with avatar and action buttons.
  - **Push**: Mobile lock-screen card with notification icon.
  - **Tool / Webhook**: JSON wire payload view.
- **Dynamic Variable Interpolation**: Live interpolation of `{{variables}}` from JSON state.
- **Live Sandbox Dispatch**: Sends a real test dispatch via `POST /v1/admin/composer/send-test` with instant receipt.

### 8. Webhook Subscriptions & DLR Inspector (`WebhooksPage`)
- **Customer Webhook Endpoints**: Manage endpoint URLs, subscribed events, and HMAC-SHA256 signing keys.
- **Real-Time Delivery Receipts (DLR)**: Live log of delivery attempts, HTTP status codes, and round-trip latencies.

### 9. System Topology & Prometheus Scraper (`ArchitecturePage`)
- **Cluster Architecture Topology**: Interactive breakdown of Tier 1 Fast-Path, Tier 2 Range Partitions, and Tier 3 BullMQ Pipelines.
- **Prometheus `/metrics` Scraper**: In-app inspector for Prometheus metrics counters, gauges, and latency histograms.

### 10. Security & Compliance Audit Ledger (`AuditPage`)
- **Cryptographic Audit Log**: Immutable ledger of all admin mutations (circuit overrides, DLQ replays, suppression additions).
- **Tamper-Evident SHA-256 Hashes**: Chained cryptographic verification of audit records.

---

## 🎨 Design System & Keyboard Shortcuts

- **Theme**: Cyber Dark Obsidian (`#090d16` background with glassmorphism and neon accents).
- **Typography**: Inter + JetBrains Mono.
- **Global Search**: Press **`⌘K`** (or `Ctrl+K`) anywhere to open the command palette and jump to any view, provider, or trace.
