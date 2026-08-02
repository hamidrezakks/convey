# Health Checks & Prometheus Observability Metrics

Convey includes high-performance health probes and a native **Prometheus Metrics Registry** for monitoring database connectivity, Redis connection pools, partition validity, circuit breaker trips, queue saturation, and custom WhatsApp cost savings.

---

## 1. Readiness Health Check (`GET /health/readiness`)

### Use Case
Kubernetes readiness probes and load balancer health checks to determine if Convey is ready to accept incoming API traffic.

### cURL Request
```bash
curl -i -X GET http://localhost:3000/health/readiness
```

### HTTP Response (`200 OK`)
```json
{
  "ready": true,
  "uptime": 1420.52,
  "checks": {
    "db": "connected",
    "redis": "connected",
    "partitions": {
      "checkedAt": "2026-08-13T18:00:00.000Z",
      "valid": true
    }
  },
  "circuitBreakers": {
    "counts": {
      "closed": 6,
      "open": 0,
      "halfOpen": 0
    },
    "statuses": [
      { "providerId": "twilio", "state": "CLOSED", "failureCount": 0 },
      { "providerId": "sendgrid", "state": "CLOSED", "failureCount": 0 }
    ]
  },
  "providers": {
    "configuredCount": 6,
    "byChannel": {
      "email": 2,
      "sms": 2,
      "whatsapp": 1,
      "telegram": 1
    }
  },
  "workers": {
    "active": true,
    "count": 6
  },
  "bootstrappedAt": "2026-08-13T18:00:00.000Z",
  "timestamp": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Liveness Health Check (`GET /health/liveness`)

### Use Case
Kubernetes liveness probe to verify the V8 event loop is active.

### cURL Request
```bash
curl -i -X GET http://localhost:3000/health/liveness
```

### HTTP Response (`200 OK`)
```json
{
  "status": "alive",
  "uptime": 1420.52,
  "timestamp": "2026-08-13T18:25:00.000Z"
}
```

---

## 3. Prometheus Metrics Endpoint (`GET /metrics`)

### Use Case
Scraping operational metrics into Prometheus / Grafana dashboards.

### cURL Request
```bash
curl -i -X GET http://localhost:3000/metrics
```

### Response (`200 OK` - Prometheus Text Format)
```text
# HELP convey_http_requests_total Total HTTP requests processed by Convey
# TYPE convey_http_requests_total counter
convey_http_requests_total{method="POST",path="/v1/messages",status="202"} 14205
convey_http_requests_total{method="GET",path="/health/readiness",status="200"} 284

# HELP convey_messages_accepted_total Total messages accepted for asynchronous dispatch
# TYPE convey_messages_accepted_total counter
convey_messages_accepted_total{team="engineering",category="security_alert",priority="critical"} 890
convey_messages_accepted_total{team="marketing",category="newsletter",priority="marketing"} 12400

# HELP convey_whatsapp_session_optimizations_total Total WhatsApp template messages converted to zero-cost plain text session messages
# TYPE convey_whatsapp_session_optimizations_total counter
convey_whatsapp_session_optimizations_total{providerId="cequens-whatsapp"} 342

# HELP convey_whatsapp_session_cost_saved_usd_total Total estimated USD saved by optimizing template messages to session text messages
# TYPE convey_whatsapp_session_cost_saved_usd_total counter
convey_whatsapp_session_cost_saved_usd_total{providerId="cequens-whatsapp"} 17.10

# HELP convey_circuit_breaker_trips_total Total provider circuit breaker trip events
# TYPE convey_circuit_breaker_trips_total counter
convey_circuit_breaker_trips_total{providerId="sendgrid",state="OPEN"} 0
```
