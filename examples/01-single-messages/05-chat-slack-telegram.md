# Chat Integration (Slack & Telegram)

Convey supports chat channel dispatches including Telegram bot messaging (with `MarkdownV2` or `HTML` formatting) and Slack channel notifications using Slack Block Kit UI components.

---

## 1. Telegram Bot Notification (`MarkdownV2`)

### Use Case
Sending system alerts, deployment updates, or automated bot notifications to a Telegram chat or channel.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "tg_deploy_alert_release_v2_4_0",
    "userId": "sys_devops",
    "team": "infrastructure",
    "category": "deployment_alert",
    "country": "US",
    "priority": "normal",
    "recipients": {
      "telegramChatId": "-100192837465"
    },
    "channels": [
      {
        "channel": "telegram",
        "content": {
          "text": "*🚀 Production Release Successful*\n\n*Version:* `v2.4.0`\n*Environment:* `us-east-1`\n*Status:* All 12 worker nodes healthy\\.",
          "parseMode": "MarkdownV2"
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KH8J9K0L1M2N3P4Q5R6S7",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:00.000Z"
}
```

---

## 2. Slack Block Kit Operations Alert

### Use Case
Publishing structured operational incident alerts to an internal Slack channel using Slack Block Kit elements.

### cURL Request
```bash
curl -i -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_9f8e7d6c5b4a" \
  -d '{
    "idempotencyKey": "slack_inc_alert_inc_8820",
    "userId": "sys_monitoring",
    "team": "sre",
    "category": "incident_alert",
    "country": "US",
    "priority": "critical",
    "recipients": {
      "slack": {
        "channelId": "C0512ABCDEF"
      }
    },
    "channels": [
      {
        "channel": "slack",
        "content": {
          "text": "🚨 P1 Incident Triggered: Database Latency Spike",
          "blocks": [
            {
              "type": "header",
              "text": {
                "type": "plain_text",
                "text": "🚨 P1 Incident: High Database Read Latency",
                "emoji": true
              }
            },
            {
              "type": "section",
              "fields": [
                { "type": "mrkdwn", "text": "*Service:* Payment Processor" },
                { "type": "mrkdwn", "text": "*Severity:* P1 - Critical" },
                { "type": "mrkdwn", "text": "*Latency:* 4,200 ms (p99)" },
                { "type": "mrkdwn", "text": "*Status:* Investigating" }
              ]
            },
            {
              "type": "actions",
              "elements": [
                {
                  "type": "button",
                  "text": { "type": "plain_text", "text": "View Incident Dashboard" },
                  "url": "https://ops.example.com/incidents/INC-8820",
                  "style": "danger"
                }
              ]
            }
          ]
        }
      }
    ]
  }'
```

### HTTP Response (`202 Accepted`)
```json
{
  "messageId": "msg_01J5KJ9K0L1M2N3P4Q5R6S7T8",
  "state": "accepted",
  "createdAt": "2026-08-13T18:25:05.000Z"
}
```

---

## 🔍 Validation Rules

- **Telegram**: Requires `recipients.telegramChatId`. Optional `parseMode` supports `"HTML"` or `"MarkdownV2"`.
- **Slack**: Requires `recipients.slack.channelId`. Content includes fallback plain text (`text`) and optional Block Kit array (`blocks`).
