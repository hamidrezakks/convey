# Convey Observability, Telemetry & Distributed Tracing Specification

Convey delivers enterprise-grade observability through **Prometheus metrics**, **W3C Distributed TraceContext propagation**, **Pino structured JSON logging**, and **multi-stage Kubernetes health probes**.

---

## 1. Prometheus Metrics Catalog (`GET /metrics`)

All metrics are registered in a centralized Prometheus registry (`metricsRegistry`) exported in standard Prometheus exposition format at `GET /metrics`.

### 1.1 HTTP API Ingestion Metrics
| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `convey_http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests handled by the Elysia.js gateway. |
| `convey_http_request_duration_seconds` | Histogram | `method`, `path`, `status` | HTTP request duration in seconds. Buckets: `[0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`. |

### 1.2 Message & Queue Processing Metrics
| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `convey_messages_accepted_total` | Counter | `team`, `category`, `priority` | Total messages durably accepted into transactional outbox. |
| `convey_messages_dispatched_total` | Counter | `team`, `channel`, `provider_id` | Messages dispatched to external provider adapters. |
| `convey_messages_delivered_total` | Counter | `team`, `channel`, `provider_id` | Delivery confirmations received (sync or webhook). |
| `convey_messages_failed_total` | Counter | `team`, `channel`, `error_code` | Delivery failures classified by normalized error code. |
| `convey_queue_depth_gauge` | Gauge | `queue_name`, `state` | BullMQ job counts (`waiting`, `active`, `delayed`, `failed`). |
| `convey_outbox_lag_seconds` | Gauge | `shard_id` | Difference between current time and oldest pending outbox record. |

### 1.3 Provider & Circuit Breaker Metrics
| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `convey_provider_duration_seconds` | Histogram | `channel`, `provider_id`, `status` | Upstream provider HTTP round-trip latency. |
| `convey_circuit_breaker_state` | Gauge | `channel`, `provider_id` | Circuit breaker status (`0 = CLOSED`, `1 = HALF_OPEN`, `2 = OPEN`). |
| `convey_whatsapp_session_savings_usd` | Counter | `provider_id` | Accumulated financial savings from 24h WhatsApp text transforms. |

---

## 2. W3C Distributed TraceContext Propagation

Convey transparently implements the **W3C Trace Context Specification** (`traceparent` header) across distributed microservice boundaries:

```text
[Client Service] ──(traceparent: 00-4bf92f35...-01)──► [Convey API Gateway]
                                                               │ (Extracts / Injects)
                                                               ▼
                                               [PostgreSQL outbox Table]
                                                               │ (Propagated in payload._trace)
                                                               ▼
                                               [BullMQ Worker Job]
                                                               │ (Attaches traceparent)
                                                               ▼
                                               [Upstream Provider HTTP Request]
                                                               │ (Inbound Webhook Receipt)
                                                               ▼
                                               [Customer Webhook Dispatch]
```

### Traceparent Header Format
`00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
- `version`: `00`
- `trace_id`: 32-hex character unique trace identifier (`4bf92f3577b34da6a3ce929d0e0e4736`)
- `parent_id` / `span_id`: 16-hex character span identifier (`00f067aa0ba902b7`)
- `trace_flags`: 2-hex bitmask (`01` = recorded/sampled).

Convey automatically generates a new trace context if none is provided, allowing distributed trace correlation across APM tools (Datadog, Dynatrace, New Relic, Grafana Tempo).

---

## 3. Structured JSON Logging Taxonomy

Logging is driven by `PinoLogger` (`src/utils/logger.ts`) emitting single-line JSON log events to `stdout`. Controlled via `LOG_LEVEL` (`trace`, `debug`, `info`, `warn`, `error`).

### Standard Log Schema Example
```json
{
  "level": 30,
  "time": 1786500600120,
  "service": "convey",
  "component": "ProviderSend",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "team": "payments",
  "messageId": "msg_01J0N7C0W7X2R6S8V9Q9B1E4G3",
  "channel": "email",
  "providerId": "ses",
  "durationMs": 48,
  "status": "delivered",
  "msg": "Message successfully accepted by AWS SES v2"
}
```

---

## 4. Multi-Stage Health Probes Specification

| Probe Endpoint | Target Evaluator | Expected Healthy Response | Unhealthy Action |
| :--- | :--- | :--- | :--- |
| **`GET /health`** | System Admin / Monitoring | `HTTP 200 OK` (Full subsystem status dictionary) | `HTTP 503` if DB or Redis ping fails. |
| **`GET /health/readiness`** | Kubernetes Readiness Probe / Load Balancer | `HTTP 200 OK` when `ready === true` | `HTTP 503` during startup or graceful shutdown drainage. |
| **`GET /health/liveness`** | Kubernetes Liveness Probe | `HTTP 200 OK` (`uptime` counter responsive) | Pod restart if event loop is deadlocked. |

---

## 5. Production Alerting Recommendations

| Alert Condition | Metric Threshold | Recommended Severity | Mitigation Playbook |
| :--- | :--- | :--- | :--- |
| **Hot-Path Latency Breach** | `p99(convey_http_request_duration_seconds) > 50ms` | P2 - Warning | Inspect PostgreSQL transaction lock wait time and Redis connection pool latency. |
| **Provider Circuit Breaker Tripped** | `convey_circuit_breaker_state == 2 (OPEN)` | P1 - Urgent | Verify upstream vendor status page, API credentials, and network routing. |
| **Outbox Processing Lag Spike** | `convey_outbox_lag_seconds > 60s` | P1 - Urgent | Scale outbox relay worker replicas or adjust `ConsistentHashShardRouter` concurrency. |
| **Elevated DLQ Failure Rate** | `rate(convey_messages_failed_total[5m]) > 5%` | P2 - Warning | Inspect `/v1/dlq` error messages for malformed recipient data or vendor rate-limits. |
| **V8 Heap Memory Saturation** | `process_resident_memory_bytes > 85% limit` | P1 - Urgent | Check `HeapMemoryGuard` throttling and verify worker batch sizing. |
