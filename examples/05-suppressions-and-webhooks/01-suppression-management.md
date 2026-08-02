# Compliance & Suppression List Management (`/v1/suppressions`)

Convey enforces built-in **Compliance Suppressions** with sub-millisecond Redis fast-path caching and strict multi-tenant isolation. Recipients who opt out, unsubscribe, or generate hard email bounces / spam complaints are added to the suppression list.

Subsequent message dispatches matching suppressed identifiers are blocked automatically at the outbox routing stage (`suppression.blocked`) before incurring provider charges.

---

## 1. Add Recipient to Suppression List (`POST /v1/suppressions`)

### Use Case
Adding an email address or phone number to the team suppression list following an unsubscribe, spam complaint, or temporary block.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/suppressions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "identifier": "optout@example.com",
    "identifierType": "email",
    "reason": "User unsubscribed via preference center",
    "category": "marketing",
    "channel": "email",
    "endsAt": "2026-12-31T23:59:59.000Z"
  }'
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "suppression": {
    "id": "supp_01J5KW1X2Y3Z4A5B6C7D8E9F0G",
    "team": "default-team",
    "recipient": "optout@example.com",
    "identifierType": "email",
    "reason": "User unsubscribed via preference center",
    "category": "marketing",
    "channel": "email",
    "endsAt": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-08-13T18:25:00.000Z"
  }
}
```

---

## 2. Bulk Add Recipients (`POST /v1/suppressions/bulk`)

### Use Case
Importing batch lists of unsubscribed email addresses or blocked phone numbers from external systems.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/suppressions/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "items": [
      {
        "identifier": "bounced1@example.com",
        "reason": "Hard bounce",
        "channel": "email"
      },
      {
        "identifier": "+15550001111",
        "reason": "SMS STOP request",
        "channel": "sms"
      }
    ]
  }'
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "count": 2,
  "suppressions": [ ... ]
}
```

---

## 3. List Team Suppressions with Search & Pagination (`GET /v1/suppressions`)

### cURL Request
```bash
curl -i -X GET "http://localhost:3000/v1/suppressions?limit=20&offset=0&search=bounce&channel=email" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "suppressions": [
    {
      "id": "supp_01J5KW1X2Y3Z4A5B6C7D8E9F0G",
      "team": "default-team",
      "recipient": "bounced1@example.com",
      "identifierType": "email",
      "reason": "Hard bounce",
      "category": null,
      "channel": "email",
      "createdAt": "2026-08-13T18:25:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## 4. Remove Suppression Record (`DELETE /v1/suppressions/:id`)

### Use Case
Re-activating a recipient who explicitly requested to re-subscribe.

### cURL Request
```bash
curl -i -X DELETE http://localhost:3000/v1/suppressions/supp_01J5KW1X2Y3Z4A5B6C7D8E9F0G \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "success": true
}
```

