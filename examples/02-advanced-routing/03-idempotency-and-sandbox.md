# Idempotency & Sandbox Mode

Convey includes an ultra-fast **1-RTT Redis Idempotency Engine** to eliminate duplicate message dispatches under network retries, and a **Sandbox Test Mode** for offline integration testing without invoking external paid provider APIs.

---

## 1. Zero-Duplicate Idempotency Guarantees

### Concept
Clients pass a unique `idempotencyKey` in the JSON request body.
- **Fast Path (New Key)**: Convey executes a single atomic Redis `SET key value EX 86400 NX` call. If acquired, Convey inserts the message records into PostgreSQL and records the result as `COMPLETED`. Returns `202 Accepted`.
- **Re-submission (Same Key + Same Payload)**: Convey detects the cached completed key and immediately returns the original cached response with `202 Accepted` without re-creating outbox jobs or contacting providers.
- **Conflict (Same Key + Different Payload)**: Convey returns `409 Conflict`.

### Re-Submission Request (Identical Payload)
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "unique_tx_key_8891002",
    "userId": "usr_1001",
    "team": "billing",
    "category": "invoice",
    "country": "US",
    "priority": "normal",
    "recipients": { "email": "billing@example.com" },
    "channels": [ { "channel": "email", "content": { "subject": "Invoice #889", "text": "Invoice details..." } } ]
  }'
```

### HTTP Response (`202 Accepted` - Cached Result Returned)
```json
{
  "messageId": "msg_01J5KN3P4Q5R6S7T8U9V0W1X2",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

### Conflict Request (Same Key, Modified Payload)
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "unique_tx_key_8891002",
    "userId": "usr_1001",
    "team": "billing",
    "category": "invoice",
    "country": "US",
    "priority": "normal",
    "recipients": { "email": "DIFFERENT_EMAIL@example.com" },
    "channels": [ { "channel": "email", "content": { "subject": "Invoice #889", "text": "Different content" } } ]
  }'
```

### HTTP Response (`409 Conflict`)
```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Idempotency key unique_tx_key_8891002 was already used with a different request payload"
  }
}
```

---

## 2. Sandbox Mode Integration Testing

### Concept
Pass header `x-convey-sandbox: true` or use a test API key starting with `sk_test_`. Messages are fully validated, assigned public IDs, stored in the DB, and processed by outbox routines, but delivery attempts are handled by simulated sandbox adapters without calling third-party provider APIs.

### Sandbox cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_demo_key_123" \
  -H "x-convey-sandbox: true" \
  -d '{
    "idempotencyKey": "sandbox_test_msg_001",
    "userId": "usr_qa_01",
    "team": "qa_team",
    "category": "test_notification",
    "country": "US",
    "priority": "normal",
    "recipients": { "email": "qa@example.com" },
    "channels": [ { "channel": "email", "content": { "subject": "Sandbox Email", "text": "Testing delivery flow" } } ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KP4Q5R6S7T8U9V0W1X2Y3",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

### Query Sandbox Dispatches (`GET /v1/sandbox/messages`)
```bash
curl -i -X GET http://localhost:3000/v1/sandbox/messages \
  -H "Authorization: Bearer sk_test_demo_key_123"
```

### Clear Sandbox Dispatches (`DELETE /v1/sandbox/messages`)
```bash
curl -i -X DELETE http://localhost:3000/v1/sandbox/messages \
  -H "Authorization: Bearer sk_test_demo_key_123"
```
```json
{
  "success": true,
  "count": 1
}
```
