# Bulk Message Dispatches (`POST /v1/messages/bulk`)

Convey features a **Micro-Batch Ingestion Pipeline** capable of accepting array dispatches of up to **500 messages per HTTP request**.

It processes idempotency checks in bulk, validates recipient requirements, and commits all valid messages into PostgreSQL partitions in a single optimized database transaction.

---

## 1. Multi-Recipient Bulk Send Request

### Use Case
Sending a localized notification broadcast or notification digest to multiple users in a single API call.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "messages": [
      {
        "idempotencyKey": "bulk_msg_usr_101_v1",
        "userId": "usr_101",
        "team": "marketing",
        "category": "newsletter",
        "country": "US",
        "priority": "marketing",
        "recipients": { "email": "alice@example.com" },
        "channels": [
          { "channel": "email", "content": { "subject": "Weekly Tech Digest #42", "text": "Here are the top stories this week..." } }
        ]
      },
      {
        "idempotencyKey": "bulk_msg_usr_102_v1",
        "userId": "usr_102",
        "team": "marketing",
        "category": "newsletter",
        "country": "GB",
        "priority": "marketing",
        "recipients": { "email": "bob@example.co.uk" },
        "channels": [
          { "channel": "email", "content": { "subject": "Weekly Tech Digest #42", "text": "Here are the top stories this week..." } }
        ]
      },
      {
        "idempotencyKey": "bulk_msg_usr_103_v1",
        "userId": "usr_103",
        "team": "marketing",
        "category": "newsletter",
        "country": "DE",
        "priority": "marketing",
        "recipients": { "phone": "+4915123456789" },
        "channels": [
          { "channel": "sms", "content": { "text": "Acme Store: Weekly Digest #42 is ready. View at https://example.de/d/42" } }
        ]
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "total": 3,
  "items": [
    {
      "index": 0,
      "statusCode": 202,
      "body": {
        "messageId": "msg_01J5KQ5R6S7T8U9V0W1X2Y3Z4",
        "state": "accepted",
        "createdAt": "2026-08-13T18:25:00.000Z"
      }
    },
    {
      "index": 1,
      "statusCode": 202,
      "body": {
        "messageId": "msg_01J5KR6S7T8U9V0W1X2Y3Z4A5",
        "state": "accepted",
        "createdAt": "2026-08-13T18:25:00.000Z"
      }
    },
    {
      "index": 2,
      "statusCode": 202,
      "body": {
        "messageId": "msg_01J5KS7T8U9V0W1X2Y3Z4A5B6",
        "state": "accepted",
        "createdAt": "2026-08-13T18:25:00.000Z"
      }
    }
  ]
}
```

---

## 2. Partial Validation Failure Response

If one item in a bulk request fails validation (e.g., missing required email for an email channel), valid items are processed cleanly while invalid items return item-level error details:

```json
{
  "total": 2,
  "items": [
    {
      "index": 0,
      "statusCode": 202,
      "body": {
        "messageId": "msg_01J5KT8U9V0W1X2Y3Z4A5B6C7",
        "state": "accepted",
        "createdAt": "2026-08-13T18:25:00.000Z"
      }
    },
    {
      "index": 1,
      "statusCode": 400,
      "body": {
        "error": {
          "code": "BAD_REQUEST",
          "message": "Valid email address is required for email channel"
        }
      }
    }
  ]
}
```

---

## 🔍 Micro-Batch Performance Benefits

1. **Reduced HTTP Overhead**: Send up to 500 messages in a single network round-trip.
2. **Bulk Redis Pipeline**: Idempotency reservations are executed via Redis `MGET`/`MSET` pipeline scripts (`IdempotencyService.reserveBulk`).
3. **Single SQL Insert**: Inserts all validated messages and outbox records in 1 combined SQL query (`tx.insert(messages).values(...)`).
