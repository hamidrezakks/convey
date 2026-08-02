# Message Status & Event Timeline Audit (`/v1/messages/:id`)

Convey provides end-to-end delivery tracking for every message. Database queries compute the precise monthly partition window (`computePartitionWindow(publicId)`) to ensure fast sub-millisecond lookups without scanning historic table partitions.

---

## 1. Query Message Delivery Status (`GET /v1/messages/:messageId`)

### cURL Request
```bash
curl -i -X GET http://localhost:3000/v1/messages/msg_01J5KB2C3D4E5F6G7H8J9K0L1 \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "messageId": "msg_01J5KB2C3D4E5F6G7H8J9K0L1",
  "state": "delivered",
  "userId": "usr_55102",
  "team": "auth_platform",
  "category": "otp_verification",
  "country": "US",
  "createdAt": "2026-08-13T18:25:00.000Z",
  "channels": [
    {
      "channel": "sms",
      "state": "delivered",
      "providerAttempts": 1,
      "provider": "twilio",
      "acceptedAt": "2026-08-13T18:25:00.120Z",
      "deliveredAt": "2026-08-13T18:25:01.450Z"
    }
  ]
}
```

---

## 2. Query Message Status with Full Timeline (`GET /v1/messages/:id?include=timeline` or `/:id/timeline`)

### Use Case
Debugging delivery delays or auditing provider attempts, retries, policy rate limits, and webhook callbacks.

### cURL Request
```bash
curl -i -X GET http://localhost:3000/v1/messages/msg_01J5KB2C3D4E5F6G7H8J9K0L1/timeline \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "messageId": "msg_01J5KB2C3D4E5F6G7H8J9K0L1",
  "timeline": [
    {
      "channel": "sms",
      "event": "routing.resolved",
      "at": "2026-08-13T18:25:00.050Z"
    },
    {
      "channel": "sms",
      "event": "attempt.retrying",
      "at": "2026-08-13T18:25:00.120Z"
    },
    {
      "channel": "sms",
      "event": "delivery.delivered",
      "at": "2026-08-13T18:25:01.450Z"
    }
  ]
}
```

---

## 🔍 Partition Pruning Architecture

Every message public ID (`msg_<ULID>`) encodes an embedded timestamp in its ULID prefix.
When calling `/v1/messages/:messageId`, `parseMessageIdTimestamp(publicId)` extracts the creation date, allowing Drizzle ORM to generate SQL queries scoped strictly to the target month's table partition:

```sql
SELECT * FROM "messages"
WHERE "public_id" = 'msg_01J5KB2C3D4E5F6G7H8J9K0L1'
  AND "created_at" >= '2026-08-01 00:00:00.000Z'
  AND "created_at" <= '2026-08-31 23:59:59.999Z';
```
