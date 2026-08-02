# Webhooks, Tracking Pixels, & Client Receipts

Convey supports bi-directional webhook processing:
1. **Outgoing Webhook Subscriptions (`/v1/webhook-subscriptions`)**: Deliver real-time message state events to your backend HTTP endpoints.
2. **Inbound Provider Webhooks (`/v1/webhooks/:provider`)**: Receive delivery callbacks from Twilio, SendGrid, Infobip, Cequens, etc.
3. **Open Pixel Tracking (`GET /v1/t/:token`)**: Track email open events via invisible 1x1 transparent GIF pixels.
4. **Client Receipts (`POST /v1/receipts`)**: Mobile SDK or web client delivery confirmations.

---

## 1. Create Outgoing Webhook Subscription (`POST /v1/webhook-subscriptions`)

### Use Case
Subscribing your backend application to receive real-time delivery notifications (`delivery.delivered`, `attempt.failed`, `bounced`, `opened`).

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/webhook-subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "url": "https://api.example.com/webhooks/convey",
    "events": [
      "delivery.delivered",
      "attempt.failed",
      "bounced",
      "opened"
    ],
    "secret": "whsec_994012837465"
  }'
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "subscription": {
    "id": "sub_01J5KX2Y3Z4A5B6C7D8E9F0G1H",
    "tenantId": "default-tenant",
    "team": "default-team",
    "url": "https://api.example.com/webhooks/convey",
    "events": [
      "delivery.delivered",
      "attempt.failed",
      "bounced",
      "opened"
    ],
    "createdAt": "2026-08-13T18:25:00.000Z"
  }
}
```

---

## 2. Send Test Webhook Ping (`POST /v1/webhook-subscriptions/:id/test`)

```bash
curl -i -X POST http://localhost:3000/v1/webhook-subscriptions/sub_01J5KX2Y3Z4A5B6C7D8E9F0G1H/test \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a"
```

### HTTP Response (`200 OK`)
```json
{
  "success": true,
  "message": "Test event queued for delivery"
}
```

---

## 3. Inbound Provider Webhook Callback (`POST /v1/webhooks/:provider`)

### Use Case
External communication providers (e.g. Twilio, Cequens, SendGrid) posting delivery status updates to Convey.

### cURL Request (Simulating Twilio Inbound Webhook)
```bash
curl -i -X POST http://localhost:3000/v1/webhooks/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123456789&MessageStatus=delivered&To=%2B14155552671&From=%2B18005550199"
```

### HTTP Response (`200 OK`)
```json
{
  "status": "accepted",
  "provider": "twilio",
  "providerMessageId": "SM123456789"
}
```

---

## 4. Open Pixel Tracking (`GET /v1/t/:token`)

### Use Case
Embedding an invisible tracking pixel into outgoing HTML emails to track read/open engagement.

### cURL Request
```bash
curl -i -X GET "http://localhost:3000/v1/t/trk_token_99201837465"
```

### HTTP Response (`200 OK` - 1x1 Transparent GIF Image)
```http
HTTP/1.1 200 OK
Content-Type: image/gif
Cache-Control: no-cache, no-store, must-revalidate

[1x1 GIF Binary Buffer Data]
```

---

## 5. Client Receipt Confirmation (`POST /v1/receipts`)

### Use Case
Direct delivery confirmation from client mobile applications (iOS / Android / Web SDKs).

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "msg_01J5KB2C3D4E5F6G7H8J9K0L1",
    "channel": "apns",
    "event": "read"
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "status": "accepted"
}
```
