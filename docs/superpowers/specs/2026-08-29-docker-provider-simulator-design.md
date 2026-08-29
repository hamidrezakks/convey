# Production Docker Provider Simulator & Multi-Container Test Engine

## Executive Summary
This design specification defines the architecture, protocol emulation, high-visibility container logging, asynchronous webhook lifecycle callback, and multi-container Docker topology for the **Convey Provider Simulation Subsystem** (`apps/mock-server`).

This system enables realistic production, staging, and integration testing of the entire Convey communication platform across all 5 canonical channels (Email, SMS, Chat, Push, Tool) and all 88 provider integrations without requiring real third-party API credentials, credit cards, or external network dependencies.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DOCKER NETWORK                                     │
│                                    (convey-network)                                    │
│                                                                                        │
│  ┌──────────────────────────┐                   ┌───────────────────────────────────┐  │
│  │      convey-server       │                   │    PostgreSQL 18 + DragonflyDB    │  │
│  │   (API & Worker Queue)   │◄─────────────────►│   (State, Queues, Partitioned)    │  │
│  └─────────────┬────────────┘                   └───────────────────────────────────┘  │
│                │                                                                       │
│                │ Outbound HTTP Requests (Transparent DNS Aliases & Base URLs)          │
│                ├───────────────────────────────┬───────────────────────────────┐       │
│                ▼                               ▼                               ▼       │
│  ┌───────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────┐ │
│  │     convey-mock-resend    │   │    convey-mock-twilio     │   │ convey-mock-slack │ │
│  │   (api.resend.com:4001)   │   │   (api.twilio.com:4002)   │   │ (slack.com:4003)  │ │
│  │  - Official Schema Check  │   │  - Form & JSON Validation │   │  - Chat PostMsg   │ │
│  │  - Authentic re_... IDs   │   │  - SM... SID Generation   │   │  - ts Timestamp   │ │
│  │  - Box-formatted stdout   │   │  - Box-formatted stdout   │   │  - Box-formatted  │ │
│  └─────────────┬─────────────┘   └─────────────┬─────────────┘   └─────────────┬─────┘ │
│                │                               │                               │       │
│                └───────────────────────────────┼───────────────────────────────┘       │
│                                                │                                       │
│                                                ▼                                       │
│                                 Async Delivery Webhooks (300-500ms)                    │
│                                 POST /v1/webhooks/providers/:providerId                │
│                                 (delivered, bounced, read, failed)                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure (`apps/mock-server`)

```
apps/mock-server/
├── package.json               # Standalone Bun workspace package (@convey/mock-server)
├── tsconfig.json              # TypeScript compilation config
├── src/
│   ├── index.ts               # Server entrypoint (detects single-provider mode or universal gateway mode)
│   ├── config.ts              # Environment configuration & defaults
│   ├── core/
│   │   ├── engine.ts          # Core request router & handler dispatcher
│   │   ├── logger.ts          # High-visibility structured terminal logger (box drawing, colored request diffs)
│   │   ├── id-generator.ts    # Official provider ID generators (Twilio SM/MM..., Resend re_..., SendGrid msgId, etc.)
│   │   ├── webhook-client.ts  # Async webhook delivery callback dispatcher
│   │   ├── chaos.ts           # Latency injector & error simulator
│   │   └── types.ts           # Shared mock handler interfaces & request context
│   └── handlers/
│       ├── email/             # Resend, SendGrid, SES, Mailgun, Postmark, Brevo, Mailtrap, Plunk, SparkPost, Mailjet, Mandrill, EmailJS, Mailersend, Netcore, AnyPost, Braze, Outlook365, Nodemailer, EmailWebhook
│       ├── sms/               # Twilio, Infobip, Bandwidth, Plivo, MessageBird, Telnyx, Sinch, Nexmo, Termii, AfroSMS, CMTelecom, RingCentral, AzureSMS, Gupshup, ClickSend, SimpleTexting, Kannel, Cequens, SMS77, Maqsam, BurstSMS, GenericSMS, Sendchamp
│       ├── chat/              # Slack, Telegram, Discord, MSTeams, WhatsApp Business, Twilio WhatsApp, Line, Zulip, RocketChat, Cequens WhatsApp, Mattermost, GetStream, Webex, Grafana OnCall, Sendblue, Ryver, ChatWebhook
│       ├── push/              # FCM (v1 & legacy), APNs, Expo, OneSignal, Pusher Beams, Pushpad, Appio, PushWebhook
│       └── tool/              # PagerDuty, Opsgenie, Grafana, ToolWebhook
└── tests/
    ├── email-handlers.test.ts # Comprehensive tests for email mocks
    ├── sms-handlers.test.ts   # Comprehensive tests for SMS mocks
    ├── chat-handlers.test.ts  # Comprehensive tests for Chat mocks
    ├── push-handlers.test.ts  # Comprehensive tests for Push mocks
    ├── tool-handlers.test.ts  # Comprehensive tests for Tool mocks
    └── webhook-chaos.test.ts  # Verification of async webhook & chaos engines
```

---

## 3. Realistic Protocol & Schema Specifications

Each mock handler enforces authentic headers, parameter validation, and official response schemas based on real provider documentation:

### 3.1. Email Channel
- **Resend** (`POST /emails`): Validates `from`, `to`, `subject`, and `html`/`text`. Requires Bearer auth. Returns `200 OK` with `{ "id": "re_01J6G7H8K9L0M1N2P3Q4R5S6T7" }`.
- **SendGrid** (`POST /v3/mail/send`): Validates `personalizations`, `from`, `content`. Returns `202 Accepted` with header `X-Message-Id: SG.01J6G7...`.
- **AWS SES** (`POST /v2/email/outbound-emails`): Validates AWS credentials, destination, and content. Returns `200 OK` with `{ "MessageId": "0100017a-000000" }`.
- **Mailgun** (`POST /v3/{domain}/messages`): Validates domain, basic auth, `to`, `from`, `subject`. Returns `200 OK` with `{ "id": "<20260829...@domain>", "message": "Queued. Thank you." }`.
- **Postmark** (`POST /email`): Validates `X-Postmark-Server-Token`, `From`, `To`, `Subject`. Returns `200 OK` with `{ "To": "...", "MessageID": "...", "ErrorCode": 0, "Message": "OK" }`.
- **Brevo** (`POST /v3/smtp/email`): Validates `api-key`, `sender`, `to`, `subject`. Returns `201 Created` with `{ "messageId": "<...@smtp-relay.mailin.fr>" }`.

### 3.2. SMS Channel
- **Twilio** (`POST /2010-04-01/Accounts/{AccountSid}/Messages.json`): Validates Basic Auth (`AC...`), `To`, `From`, and `Body`. Supports `application/x-www-form-urlencoded` and `application/json`. Returns `201 Created` with authentic Twilio schema (`sid: "SM..."`, `status: "queued"`, `date_created`, etc.).
- **Infobip** (`POST /sms/2/text/advanced`): Validates API key, `messages` array, `destinations`. Returns `200 OK` with `{ "messages": [{ "messageId": "...", "status": { "name": "PENDING_ENROUTE" } }] }`.
- **Plivo** (`POST /v1/Account/{authId}/Message/`): Validates `src`, `dst`, `text`. Returns `202 Accepted` with `{ "message_uuid": ["..."], "api_id": "...", "message": "message(s) queued" }`.
- **Telnyx** (`POST /v2/messages`): Validates Bearer token, `to`, `from`, `text`. Returns `200 OK` with `{ "data": { "id": "...", "record_type": "message", "to": [...] } }`.
- **Bandwidth** (`POST /v2/users/{accountId}/messages`): Validates `to`, `from`, `text`. Returns `202 Accepted` with `{ "id": "...", "owner": "...", "applicationId": "..." }`.

### 3.3. Chat Channel
- **Slack** (`POST /api/chat.postMessage`): Validates `Authorization: Bearer xoxb-...`, `channel`, `text`/`blocks`. Returns `200 OK` with `{ "ok": true, "channel": "C12345", "ts": "1724945678.000100", "message": { ... } }`.
- **Discord** (`POST /api/webhooks/{id}/{token}` / `POST /api/v10/channels/{id}/messages`): Validates `content`, `embeds`. Returns `200 OK` with snowflake ID.
- **Telegram** (`POST /bot{token}/sendMessage`): Validates bot token in URL, `chat_id`, `text`. Returns `200 OK` with `{ "ok": true, "result": { "message_id": 123456, "chat": { "id": 98765 } } }`.
- **WhatsApp Business (Meta Cloud API)** (`POST /v18.0/{phoneNumberId}/messages`): Validates `to`, `type`, `template`/`text`. Returns `200 OK` with `{ "messaging_product": "whatsapp", "messages": [{ "id": "wamid.HBg..." }] }`.
- **MS Teams** (`POST /v1/teams/webhook`): Validates connector card or adaptive card schema. Returns `200 OK` or `1`.

### 3.4. Push Channel
- **FCM v1** (`POST /v1/projects/{project}/messages:send`): Validates OAuth2 Bearer token, `message.token`, `message.notification`. Returns `200 OK` with `{ "name": "projects/{project}/messages/0:1724945678901234" }`.
- **APNs** (`POST /3/device/{deviceToken}`): Validates `apns-topic`, `apns-push-type`, `authorization: bearer ...`. Returns `200 OK` with header `apns-id: 01928374-abcd-...`.
- **Expo** (`POST /--/api/v2/push/send`): Validates `ExponentPushToken[...]`, `title`, `body`. Returns `200 OK` with `{ "data": [{ "status": "ok", "id": "..." }] }`.
- **OneSignal** (`POST /api/v1/notifications`): Validates `app_id`, `include_player_ids`, `contents`. Returns `200 OK` with `{ "id": "...", "recipients": 1 }`.

### 3.5. Tool Channel
- **PagerDuty** (`POST /v2/enqueue`): Validates `routing_key`, `event_action: trigger|acknowledge|resolve`, `payload.summary`, `payload.severity`. Returns `202 Accepted` with `{ "status": "success", "message": "Event processed", "dedup_key": "pd_dedup_019283" }`.
- **Opsgenie** (`POST /v2/alerts`): Validates `message`, `priority`. Returns `202 Accepted` with `{ "result": "Request Will Be Processed", "took": 0.002, "requestId": "..." }`.
- **Grafana OnCall** (`POST /api/v1/alerts`): Returns `{ "alert_id": "...", "state": "created" }`.

---

## 4. Structured Console Logging

Every request generates high-visibility, box-formatted console output inside its container:

```text
┌── [MOCK-RESEND] 📥 POST /emails (200 OK - 1.4ms) ──────────────────────────────────┐
│ Timestamp:  2026-08-29T18:58:45.123Z                                              │
│ Request ID: req_01J6G7H8K9L0M1N2P3Q4R5S6T7                                        │
│ Auth:       Bearer re_prod_test_key*** (Valid Format)                             │
│ Recipient:  user@acme-corp.com                                                    │
│ From:       notifications@convey.dev                                              │
│ Subject:    "Your Verification Code"                                              │
│ Payload:    { "html": "<p>Code: 482910</p>", "tags": [{ "name": "category" }] } │
│ Generated:  MessageId: re_0192837465abcedf                                        │
│ Lifecycle:  Scheduled async 'delivered' webhook callback to Convey in 500ms       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

When an error occurs (e.g. invalid recipient, missing auth), the box is colored red/amber with full diagnostic details:

```text
┌── [MOCK-TWILIO] ❌ POST /2010-04-01/Accounts/invalid/Messages.json (401 Unauthorized) ┐
│ Timestamp:  2026-08-29T18:58:47.891Z                                                │
│ Error Code: 20003                                                                   │
│ Message:    "Authentication Error: Account SID format is invalid"                    │
│ Detail:     Basic Auth username must begin with 'AC'                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Asynchronous Webhook Callback Engine

1. Upon successful receipt of a dispatch request, if `WEBHOOK_URL` (or default `http://convey-server:3000/v1/webhooks/providers/:providerId`) is configured:
2. The mock server schedules a delayed asynchronous callback (`WEBHOOK_DELAY_MS`, default 300ms-500ms).
3. It constructs the provider-authentic webhook payload (`delivered`, `bounced`, `failed`, `read`).
4. It attaches valid signature headers (`svix-signature`, `X-Twilio-Signature`, `X-SendGrid-Signature`) and performs `POST` back to Convey Server.
5. Logs the callback event in the container terminal.

---

## 6. Docker Topology & Compose Profiles

### 6.1. Dockerfile Build Stage
Add `mock-server` target to the root `Dockerfile`:
```dockerfile
FROM base AS mock-server
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY apps/mock-server ./apps/mock-server

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["bun", "apps/mock-server/src/index.ts"]
```

### 6.2. Discrete Container Services (`docker-compose.providers.yml`)
- `mock-resend`: aliases `[api.resend.com, mock-resend]`, port `4001:4001`
- `mock-twilio`: aliases `[api.twilio.com, mock-twilio]`, port `4002:4002`
- `mock-sendgrid`: aliases `[api.sendgrid.com, mock-sendgrid]`, port `4003:4003`
- `mock-slack`: aliases `[slack.com, mock-slack]`, port `4004:4004`
- `mock-fcm`: aliases `[fcm.googleapis.com, mock-fcm]`, port `4005:4005`
- `mock-ses`: aliases `[email.us-east-1.amazonaws.com, mock-ses]`, port `4006:4006`
- `mock-pagerduty`: aliases `[events.pagerduty.com, mock-pagerduty]`, port `4007:4007`
- `mock-mailgun`: aliases `[api.mailgun.net, mock-mailgun]`, port `4008:4008`
- `mock-discord`: aliases `[discord.com, mock-discord]`, port `4009:4009`
- `mock-telegram`: aliases `[api.telegram.org, mock-telegram]`, port `4010:4010`
- `mock-gateway`: universal catch-all mock server container on port `4000:4000`

---

## 7. Production Test Automation Script

A standalone validation script `scripts/run-production-docker-test.ts` that:
1. Connects to `http://localhost:3000` (or `http://convey-server:3000`).
2. Configures/enables test providers in database or environment.
3. Sends 5 messages across Email (Resend), SMS (Twilio), Chat (Slack), Push (FCM), and Tool (PagerDuty).
4. Verifies `202 Accepted` + `msg_<ULID>`.
5. Polls status to ensure state reaches `SENT` and `DELIVERED`.
6. Inspects mock server logs via `GET /__inspect/requests`.
7. Outputs an executive summary table of all tests with pass/fail badges.
