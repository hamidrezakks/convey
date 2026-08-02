# Batch Lifecycle Management (`/v1/batches`)

When executing large-scale marketing campaigns or bulk customer notifications, Convey allows developers to initialize a **Batch Context** (`batch_<ULID>`).

Batch contexts maintain atomic counters in Redis, providing real-time throughput metrics (msg/sec), percent completed, ETA analytics, and operational controls to pause, resume, or cancel active dispatches.

---

## 1. Create Batch Context (`POST /v1/batches`)

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "totalCount": 50000,
    "metadata": {
      "campaignName": "Black Friday Promo 2026",
      "segmentId": "active_users_v3"
    }
  }'
```

### HTTP Response (`201 Created`)
```json
{
  "success": true,
  "batch": {
    "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
    "tenantId": "default-tenant",
    "team": "default-team",
    "totalCount": 50000,
    "processedCount": 0,
    "successCount": 0,
    "failureCount": 0,
    "status": "processing",
    "metadata": {
      "campaignName": "Black Friday Promo 2026",
      "segmentId": "active_users_v3"
    },
    "createdAt": "2026-08-13T18:25:00.000Z"
  }
}
```

---

## 2. Get Real-Time Analytics & ETA (`GET /v1/batches/:batchId`)

### cURL Request
```bash
curl -i -X GET http://localhost:3000/v1/batches/batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "batch": {
    "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
    "tenantId": "default-tenant",
    "team": "default-team",
    "totalCount": 50000,
    "processedCount": 37500,
    "successCount": 37200,
    "failureCount": 300,
    "percentComplete": 75.0,
    "throughputMsgPerSec": 850.5,
    "estimatedRemainingSeconds": 14.7,
    "status": "processing",
    "createdAt": "2026-08-13T18:25:00.000Z"
  }
}
```

---

## 3. List Team Batches (`GET /v1/batches`)

### cURL Request
```bash
curl -i -X GET http://localhost:3000/v1/batches \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "batches": [
    {
      "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
      "totalCount": 50000,
      "processedCount": 37500,
      "status": "processing",
      "createdAt": "2026-08-13T18:25:00.000Z"
    }
  ]
}
```

---

## 4. Pause Batch Execution (`POST /v1/batches/:batchId/pause`)

### Use Case
Temporarily halting outbound queue dispatches if provider limits or downstream backend systems experience unexpected strain.

```bash
curl -i -X POST http://localhost:3000/v1/batches/batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E/pause \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### Response (`200 OK`)
```json
{
  "success": true,
  "batch": {
    "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
    "status": "paused"
  }
}
```

---

## 5. Resume Batch Execution (`POST /v1/batches/:batchId/resume`)

```bash
curl -i -X POST http://localhost:3000/v1/batches/batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E/resume \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### Response (`200 OK`)
```json
{
  "success": true,
  "batch": {
    "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
    "status": "processing"
  }
}
```

---

## 6. Cancel Batch Execution (`POST /v1/batches/:batchId/cancel`)

```bash
curl -i -X POST http://localhost:3000/v1/batches/batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E/cancel \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### Response (`200 OK`)
```json
{
  "success": true,
  "batch": {
    "id": "batch_01J5KU9V0W1X2Y3Z4A5B6C7D8E",
    "status": "cancelled"
  }
}
```
