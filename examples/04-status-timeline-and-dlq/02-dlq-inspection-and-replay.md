# Dead-Letter Queue (DLQ) & Replay (`/v1/dlq`)

When message dispatches encounter permanent failures (e.g. invalid phone numbers) or exhaust all automatic retries and failover channels, they are moved to the **Dead-Letter Queue (DLQ)**.

Convey exposes REST APIs to inspect failed messages and safely trigger single or batch replaying.

---

## 1. List Failed Messages in DLQ (`GET /v1/dlq`)

### cURL Request
```bash
curl -i -X GET "http://localhost:3000/v1/dlq?limit=10&offset=0" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "total": 1,
  "limit": 10,
  "offset": 0,
  "messages": [
    {
      "messageId": "msg_01J5KV0W1X2Y3Z4A5B6C7D8E9F",
      "team": "engineering",
      "category": "security_alert",
      "state": "failed",
      "createdAt": "2026-08-13T17:45:00.000Z",
      "lastError": {
        "code": "PROVIDER_TIMEOUT",
        "category": "transient"
      }
    }
  ]
}
```

---

## 2. Replay Failed Messages (`POST /v1/dlq/replay`)

### Use Case
Re-enqueuing messages following a provider outage resolution or network recovery.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/dlq/replay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "messageIds": [
      "msg_01J5KV0W1X2Y3Z4A5B6C7D8E9F"
    ]
  }'
```

### HTTP Response (`200 OK`)
```json
{
  "replayed": [
    "msg_01J5KV0W1X2Y3Z4A5B6C7D8E9F"
  ],
  "failed": []
}
```

---

## 🔍 Replay Mechanics

1. **State Reset**: Replayed message records transition from `failed` state back to `accepted` state in PostgreSQL.
2. **New Outbox Record**: A new pending outbox record (`OutboxType.MESSAGE_DISPATCH`) is inserted for each message ID.
3. **Queue Re-injection**: `outbox-relay.worker.ts` picks up the newly created outbox record and dispatches it through the standard delivery pipeline.
