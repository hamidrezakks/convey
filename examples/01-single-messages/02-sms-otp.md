# SMS Dispatches & Critical Security OTPs

Convey processes high-priority SMS dispatches with sub-second delivery latency routing through providers like Twilio, Infobip, and Cequens.

---

## 1. High-Priority SMS Security OTP

### Use Case
Delivering 2FA/OTP login codes where ultra-fast delivery (<2 seconds) and critical queue priority are required.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "sms_otp_usr_55102_login_attempt_9921",
    "userId": "usr_55102",
    "team": "auth_platform",
    "category": "otp_verification",
    "country": "US",
    "priority": "critical",
    "recipients": {
      "phone": "+14155552671"
    },
    "channels": [
      {
        "channel": "sms",
        "content": {
          "text": "Your Acme Security code is 849201. Do not share this code with anyone. Valid for 3 minutes."
        }
      }
    ],
    "expiresAt": "2026-08-13T18:28:00Z"
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KB2C3D4E5F6G7H8J9K0L1",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Marketing / Informational SMS

### Use Case
Sending SMS updates (e.g. delivery notifications or promotional campaigns) under normal or marketing priority tiers.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "sms_mkt_promo_usr_88201",
    "userId": "usr_88201",
    "team": "marketing",
    "category": "promotional",
    "country": "GB",
    "priority": "marketing",
    "recipients": {
      "phone": "+447700900077"
    },
    "channels": [
      {
        "channel": "sms",
        "content": {
          "text": "Acme Store: Summer sale is live! Get 25% off with code SUMMER25 at checkout. Reply STOP to opt out."
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KC3D4E5F6G7H8J9K0L1M2",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:10.000Z"
}
```

---

## 🔍 Detailed Explanation

1. **Priority Scheduling**: Messages tagged with `"priority": "critical"` are automatically assigned to high-priority execution queues (`message-dispatch-high`) and bypass lower priority marketing messages.
2. **Phone Number Formatting**: Recipient phone numbers must be in normalized **E.164 format** (`+<country_code><number>`).
3. **Automatic Expiration**: The optional `expiresAt` field guarantees that stale OTP codes will not be sent by downstream providers if processing is delayed past the expiry window.
