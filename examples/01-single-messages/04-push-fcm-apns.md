# Push Notifications (FCM & APNs)

Convey supports mobile push notifications targeted at Android (Firebase Cloud Messaging - FCM) and iOS (Apple Push Notification service - APNs) devices with title, body, badge counts, alert sounds, and custom JSON key-value data payloads.

---

## 1. Firebase Cloud Messaging (FCM - Android)

### Use Case
Sending mobile push notifications to Android apps with custom data payloads.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "push_fcm_usr_44012_ride_arrived",
    "userId": "usr_44012",
    "team": "mobile_app",
    "category": "ride_status",
    "country": "US",
    "priority": "normal",
    "recipients": {
      "fcmTokens": [
        "fcm_token_device_abc123_xyz789"
      ]
    },
    "channels": [
      {
        "channel": "fcm",
        "content": {
          "title": "Your Driver Has Arrived! 🚗",
          "body": "Toyota Camry (License: 7XYZ89) is waiting for you at the pickup location.",
          "data": {
            "rideId": "ride_99201",
            "screen": "RIDE_ACTIVE",
            "driverName": "Alex"
          }
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KF6G7H8J9K0L1M2N3P4Q5",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Apple Push Notification Service (APNs - iOS)

### Use Case
Sending iOS push notifications with badge counts, custom notification sounds, and deep-link payload data.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "push_apns_usr_44012_chat_msg_109",
    "userId": "usr_44012",
    "team": "mobile_app",
    "category": "chat_message",
    "country": "US",
    "priority": "normal",
    "recipients": {
      "apnsTokens": [
        "740ab212841961e3703492825d19f635c9a7263f101ab0393f9c631a02"
      ]
    },
    "channels": [
      {
        "channel": "apns",
        "content": {
          "title": "Sarah sent you a message",
          "body": "Hey! Are we still meeting for lunch today at 1 PM?",
          "badge": 3,
          "sound": "chime.aiff",
          "data": {
            "threadId": "thread_88201",
            "action": "OPEN_THREAD"
          }
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KG7H8J9K0L1M2N3P4Q5R6",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:05.000Z"
}
```

---

## 🔍 Validation Rules

- **FCM**: Payload requires at least 1 token in `recipients.fcmTokens`. `content.data` must be a map of string key-value pairs (`Record<string, string>`).
- **APNs**: Payload requires at least 1 token in `recipients.apnsTokens`. `content.badge` must be a non-negative integer.
