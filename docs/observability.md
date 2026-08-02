# Convey Observability & Monitoring Specification

Convey provides end-to-end observability via **Prometheus metrics**, **multi-stage health probes**, **Pino structured JSON logging**, and **W3C Trace Context propagation**.

---

## 1. Prometheus Metrics (`GET /metrics`)

Convey registers metrics under Prometheus registry `metricsRegistry` exported at `GET /metrics`.

### Core Metrics

- `convey_http_requests_total`: Counter tracking total HTTP requests processed, labeled by `method`, `path`, and HTTP `status`.
- `convey_http_request_duration_seconds`: Histogram measuring HTTP latency in seconds, with buckets `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`.
- Provider attempt counters & durations (tracked in `message_attempts` and Pino logs).
- BullMQ queue backlog depth & active job counters.

---

## 2. Multi-Stage System Probes

- **`/health`**: Comprehensive status endpoint checking PostgreSQL connection, Redis connection, monthly partition status, circuit breaker states, and configured provider counts.
- **`/health/readiness`**: Kubernetes readiness probe returning `200 OK` when the service is fully ready to process traffic, and `503 Service Unavailable` during startup or graceful shutdown.
- **`/health/liveness`**: Kubernetes liveness probe returning `200 OK` as long as process execution is alive.

---

## 3. Pino Structured JSON Logging

Logging is managed via `PinoLogger` (`src/utils/logger.ts`) producing JSON log entries. Controlled via `LOG_LEVEL` (`trace`, `debug`, `info`, `warn`, `error`).

### Log Example
```json
{
  "level": "info",
  "time": 1786500600000,
  "context": "ProviderSend",
  "message": "Message successfully delivered via SES",
  "meta": {
    "messageId": "msg_01JYQ81NE7XK47PAV6MQR2P9NK",
    "providerId": "ses",
    "durationMs": 42
  }
}
```

---

## 4. W3C Trace Context Propagation

Convey automatically generates or propagates W3C Trace Context headers (`traceparent`, `tracestate`) across HTTP handlers, BullMQ jobs, and outbound provider HTTP requests (`src/utils/trace-context.ts`), allowing distributed tracing across microservice boundaries.
