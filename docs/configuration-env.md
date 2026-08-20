# Convey Configuration & Environment Variables Guide

This document is the authoritative engineering reference for configuring **Convey** across development, staging, and production environments.

Convey supports a **dual-tier configuration architecture**:
1. **Core Infrastructure Configuration**: Bootstrapped via static Environment Variables (`.env`, Kubernetes ConfigMaps/Secrets).
2. **Dynamic Provider & Policy Configuration**: Stored in PostgreSQL with real-time **`< 1ms`** hot-reloading across distributed worker clusters via Redis PubSub.

---

## 1. Core Server & Runtime Variables

These variables control HTTP gateway behavior, runtime modes, and cluster identity.

| Variable | Type | Default | Allowed Values | Description |
| :--- | :---: | :---: | :---: | :--- |
| `PORT` | Number | `3000` | `1024` – `65535` | The TCP port the Elysia HTTP server listens on. In containerized environments (e.g. AWS ECS, GCP Cloud Run, Kubernetes), bind to `3000` or the port assigned by `$PORT`. |
| `NODE_ENV` | Enum | `development` | `development`, `test`, `production` | Execution environment. In `production`, detailed error stack traces are suppressed, OpenAPI Swagger UI is guarded, and performance telemetry is enabled. |
| `LOG_LEVEL` | Enum | `info` | `trace`, `debug`, `info`, `warn`, `error` | Granularity of structured JSON logs written to `stdout`. Set to `debug` or `trace` for deep local debugging or outbox relay profiling. |
| `CONVEY_REQUIRE_AUTH` | Boolean | `false` | `true`, `false` | When `true`, enforces strict API key verification (`Authorization: Bearer <key>`) across all tenant endpoints. When `false`, requests default to internal dev tenant credentials. |

---

## 2. Database & Connection Pool Configuration

Convey utilizes PostgreSQL 16+ with **Monthly Range Partitioning** for high-volume message ledgers, audit events, and delivery attempts.

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | String | `postgres://user:password@localhost:5432/db-convey` | Full PostgreSQL connection URI. Supports standard connection strings, connection poolers (PgBouncer in transaction mode), and Unix socket paths. |
| `POSTGRES_DB` / `DB_NAME` | String | `db-convey` | Explicit database name override. If specified alongside `DATABASE_URL`, Convey dynamically rewrites the connection URI path to target this database. |
| `DB_MAX_CONNECTIONS` | Number | `20` | Maximum size of the Postgres connection pool per instance. For high-concurrency worker clusters, size appropriately to prevent exhausting Postgres `max_connections`. |

### Database Name Precedence & Resolution Logic
Convey implements deterministic connection string normalization in `src/config/env.ts`:
1. If `POSTGRES_DB` or `DB_NAME` is explicitly provided, it takes precedence.
2. If `DATABASE_URL` is provided without an explicit DB name override, the database name is extracted from the URL pathname.
3. Fallbacks to `DEFAULT_POSTGRES_DB` (`db-convey`).

---

## 3. Redis, Queues & Hybrid Dual-Layer Scheduling

Convey uses Redis 7+ for **1-RTT Idempotency Locks**, **BullMQ Worker Orchestration**, **Distributed Token-Bucket Rate Limiting**, and **Config Reloader PubSub**.

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `REDIS_URL` | String | `redis://localhost:6379` | Redis connection URI. Supports standalone Redis instances, Redis Sentinel, and AWS ElastiCache / Redis Cluster. |
| `REDIS_KEY_PREFIX` | String | `convey` | Global namespace prefix for all Redis keys, preventing collisions when sharing Redis clusters with other services. |
| `BULLMQ_SCHEDULING_HORIZON_SECONDS` | Number | `1800` (30 mins) | **Dual-Layer Hybrid Scheduling Threshold**. Notifications scheduled within this window are enqueued directly into BullMQ delayed queues. Notifications scheduled beyond this window (`> 30m`) are stored in partitioned PostgreSQL and promoted to BullMQ at $T-30$ minutes by `scheduled-promoter.worker.ts`. |

---

## 4. Security, Cryptography & Envelope Encryption

Convey enforces zero-trust privacy guarantees. Recipient PII and message bodies can be encrypted at rest before hitting PostgreSQL.

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `CONVEY_ENCRYPTION_KEY` | String | *(Auto-generated / Optional)* | 256-bit Hex-encoded or Base64 master key for AES-256-GCM envelope encryption of message payloads and credentials stored at rest. |
| `CONVEY_WEBHOOK_SIGNING_SECRET` | String | *(Optional)* | Default HMAC-SHA256 secret key used to sign outgoing webhook delivery events to customer subscription endpoints. |

---

## 5. Provider Environment Variable Resolution Matrix

Convey supports all **88 Turnkey Providers**. You can configure providers directly via environment variables without requiring database records.

Convey checks environment variables in two formats:
1. **Canonical Vendor Name**: e.g., `SENDGRID_API_KEY`
2. **Universal Prefixed Fallback**: `PROVIDER_<PROVIDER_ID>_<VARIABLE>`, e.g., `PROVIDER_SENDGRID_API_KEY`

### 5.1 Email Channel (20 Providers)
| Provider ID | Canonical Environment Variables |
| :--- | :--- |
| `ses` | `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_FROM_EMAIL` |
| `sendgrid` | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_WEBHOOK_SECRET` |
| `resend` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` |
| `mailgun` | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_BASE_URL`, `MAILGUN_FROM_EMAIL`, `MAILGUN_WEBHOOK_SECRET` |
| `postmark` | `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `POSTMARK_MESSAGE_STREAM`, `POSTMARK_WEBHOOK_SECRET` |
| `brevo` | `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_WEBHOOK_SECRET` |
| `mailjet` | `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL` |
| `sparkpost` | `SPARKPOST_API_KEY`, `SPARKPOST_ENDPOINT`, `SPARKPOST_FROM_EMAIL` |
| `mandrill` | `MANDRILL_API_KEY`, `MANDRILL_FROM_EMAIL`, `MANDRILL_SUBACCOUNT`, `MANDRILL_WEBHOOK_KEY` |
| `mailersend` | `MAILERSEND_API_KEY`, `MAILERSEND_FROM_EMAIL`, `MAILERSEND_WEBHOOK_SECRET` |
| `nodemailer` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM_EMAIL` |
| `plunk` | `PLUNK_API_KEY`, `PLUNK_FROM_EMAIL` |
| `mailtrap` | `MAILTRAP_API_KEY`, `MAILTRAP_INBOX_ID`, `MAILTRAP_FROM_EMAIL` |
| `anypost` | `ANYPOST_URL`, `ANYPOST_API_KEY`, `ANYPOST_FROM_EMAIL` |
| `braze` | `BRAZE_API_KEY`, `BRAZE_INSTANCE_URL`, `BRAZE_APP_ID`, `BRAZE_FROM_EMAIL` |
| `emailjs` | `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_USER_ID`, `EMAILJS_ACCESS_TOKEN` |
| `infobip` | `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_FROM_EMAIL` |
| `netcore` | `NETCORE_API_KEY`, `NETCORE_FROM_EMAIL` |
| `outlook365` | `OUTLOOK_TENANT_ID`, `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_FROM_EMAIL` |
| `email-webhook`| `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_SECRET`, `EMAIL_WEBHOOK_FROM` |

### 5.2 SMS Channel (39 Providers)
| Provider ID | Canonical Environment Variables |
| :--- | :--- |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| `nexmo` | `NEXMO_API_KEY`, `NEXMO_API_SECRET`, `NEXMO_FROM_NUMBER` |
| `plivo` | `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_FROM_NUMBER` |
| `sinch` | `SINCH_SERVICE_PLAN_ID`, `SINCH_API_TOKEN`, `SINCH_FROM_NUMBER` |
| `telnyx` | `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`, `TELNYX_PUBLIC_KEY` |
| `sns` | `AWS_SNS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `messagebird`| `MESSAGEBIRD_API_KEY`, `MESSAGEBIRD_FROM_NAME` |
| `bandwidth` | `BANDWIDTH_ACCOUNT_ID`, `BANDWIDTH_API_TOKEN`, `BANDWIDTH_API_SECRET`, `BANDWIDTH_APPLICATION_ID`, `BANDWIDTH_FROM_NUMBER` |
| `infobip` | `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_FROM_NUMBER` |
| `azure-sms` | `AZURE_COMMUNICATION_CONNECTION_STRING`, `AZURE_SMS_FROM_NUMBER` |
| `cequens` | `CEQUENS_API_KEY`, `CEQUENS_FROM_NAME` |
| `unifonic` | `UNIFONIC_APP_SID`, `UNIFONIC_FROM_NAME` |
| `maqsam` | `MAQSAM_ACCESS_KEY`, `MAQSAM_ACCESS_SECRET`, `MAQSAM_FROM_NUMBER` |
| `imedia` | `IMEDIA_USER_NAME`, `IMEDIA_PASSWORD`, `IMEDIA_SENDER_ID` |
| `eazy-sms` | `EAZY_SMS_API_KEY`, `EAZY_SMS_SENDER_ID` |
| `mobishastra`| `MOBISHASTRA_USER`, `MOBISHASTRA_PASSWORD`, `MOBISHASTRA_SENDER_ID` |
| `gupshup` | `GUPSHUP_USER_ID`, `GUPSHUP_PASSWORD`, `GUPSHUP_FROM_NAME` |
| `termii` | `TERMII_API_KEY`, `TERMII_FROM_NAME` |
| `africas-talking`| `AFRICAS_TALKING_USERNAME`, `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_FROM` |
| `sendchamp` | `SENDCHAMP_PUBLIC_KEY`, `SENDCHAMP_FROM_NAME` |
| `ruach-sms` | `RUACH_SMS_API_KEY`, `RUACH_SMS_SENDER_ID` |
| `afro-sms` | `AFRO_SMS_API_KEY`, `AFRO_SMS_SENDER_ID` |
| `clicksend` | `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`, `CLICKSEND_FROM` |
| `clickatell` | `CLICKATELL_API_KEY`, `CLICKATELL_FROM` |
| `burst-sms` | `BURST_SMS_API_KEY`, `BURST_SMS_API_SECRET`, `BURST_SMS_FROM` |
| `sms-central`| `SMS_CENTRAL_USERNAME`, `SMS_CENTRAL_PASSWORD`, `SMS_CENTRAL_FROM` |
| `bulk-sms` | `BULK_SMS_API_ID`, `BULK_SMS_PASSWORD`, `BULK_SMS_FROM` |
| `cm-telecom` | `CM_TELECOM_API_KEY`, `CM_TELECOM_FROM` |
| `brevo-sms` | `BREVO_SMS_API_KEY`, `BREVO_SMS_SENDER` |
| `firetext` | `FIRETEXT_API_KEY`, `FIRETEXT_FROM` |
| `forty-six-elks`| `FORTY_SIX_ELKS_USER`, `FORTY_SIX_ELKS_PASS`, `FORTY_SIX_ELKS_FROM` |
| `isend-sms` | `ISEND_SMS_API_KEY`, `ISEND_SMS_SENDER` |
| `isendpro-sms`| `ISENDPRO_API_KEY`, `ISENDPRO_SENDER` |
| `sms77` | `SMS77_API_KEY`, `SMS77_FROM` |
| `smsmode` | `SMSMODE_API_KEY`, `SMSMODE_FROM` |
| `simpletexting`| `SIMPLETEXTING_API_KEY`, `SIMPLETEXTING_FROM` |
| `ring-central`| `RINGCENTRAL_CLIENT_ID`, `RINGCENTRAL_CLIENT_SECRET`, `RINGCENTRAL_JWT`, `RINGCENTRAL_FROM` |
| `kannel` | `KANNEL_HOST`, `KANNEL_PORT`, `KANNEL_USERNAME`, `KANNEL_PASSWORD`, `KANNEL_SENDER_ID` |
| `generic-sms`| `GENERIC_SMS_URL`, `GENERIC_SMS_TOKEN`, `GENERIC_SMS_FROM` |

### 5.3 Push Notification Channel (8 Providers)
| Provider ID | Canonical Environment Variables |
| :--- | :--- |
| `fcm` | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` |
| `apns` | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_P8_CERT`, `APNS_BUNDLE_ID`, `APNS_IS_PRODUCTION` |
| `one-signal` | `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` |
| `expo` | `EXPO_ACCESS_TOKEN` |
| `pusher-beams`| `PUSHER_BEAMS_INSTANCE_ID`, `PUSHER_BEAMS_SECRET_KEY` |
| `pushpad` | `PUSHPAD_PROJECT_ID`, `PUSHPAD_AUTH_TOKEN` |
| `appio` | `APPIO_API_KEY`, `APPIO_APP_ID` |
| `push-webhook`| `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_SECRET` |

### 5.4 Chat & Instant Messaging Channel (17 Providers)
| Provider ID | Canonical Environment Variables |
| :--- | :--- |
| `whatsapp-business`| `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET` |
| `twilio-whatsapp` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| `cequens-whatsapp` | `CEQUENS_WHATSAPP_KEY`, `CEQUENS_WHATSAPP_SENDER` |
| `slack` | `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL`, `SLACK_SIGNING_SECRET` |
| `discord` | `DISCORD_WEBHOOK_URL`, `DISCORD_BOT_TOKEN` |
| `telegram` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| `msTeams` | `MSTEAMS_WEBHOOK_URL` |
| `mattermost` | `MATTERMOST_WEBHOOK_URL`, `MATTERMOST_BOT_TOKEN` |
| `line` | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` |
| `getstream` | `GETSTREAM_API_KEY`, `GETSTREAM_API_SECRET`, `GETSTREAM_APP_ID` |
| `grafana-on-call` | `GRAFANA_ONCALL_WEBHOOK_URL` |
| `rocket-chat` | `ROCKETCHAT_WEBHOOK_URL`, `ROCKETCHAT_USER_ID`, `ROCKETCHAT_AUTH_TOKEN` |
| `ryver` | `RYVER_WEBHOOK_URL` |
| `sendblue` | `SENDBLUE_API_KEY`, `SENDBLUE_API_SECRET` |
| `webex-messaging` | `WEBEX_ACCESS_TOKEN`, `WEBEX_ROOM_ID` |
| `zulip` | `ZULIP_BOT_EMAIL`, `ZULIP_API_KEY`, `ZULIP_SITE_URL` |
| `chat-webhook` | `CHAT_WEBHOOK_URL`, `CHAT_WEBHOOK_SECRET` |

### 5.5 Tool & Infrastructure Alerting (4 Providers)
| Provider ID | Canonical Environment Variables |
| :--- | :--- |
| `pagerduty` | `PAGERDUTY_ROUTING_KEY`, `PAGERDUTY_DEFAULT_SEVERITY` |
| `opsgenie` | `OPSGENIE_API_KEY`, `OPSGENIE_REGION` |
| `grafana` | `GRAFANA_ALERTMANAGER_URL`, `GRAFANA_ALERTMANAGER_TOKEN` |
| `tool-webhook` | `TOOL_WEBHOOK_URL`, `TOOL_WEBHOOK_SECRET` |

---

## 6. Complete `.env.example` Template

Below is a production-ready configuration template:

```ini
# ==============================================================================
# ⚡ CONVEY CORE RUNTIME & SERVER CONFIGURATION
# ==============================================================================
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CONVEY_REQUIRE_AUTH=false

# ==============================================================================
# 🗄️ POSTGRESQL DATABASE & CONNECTION POOL
# ==============================================================================
POSTGRES_DB=db-convey
DATABASE_URL=postgres://convey:convey@localhost:5432/db-convey
DB_MAX_CONNECTIONS=20

# ==============================================================================
# 🔴 REDIS & BULLMQ DISTRIBUTED QUEUE TOPOLOGY
# ==============================================================================
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=convey
BULLMQ_SCHEDULING_HORIZON_SECONDS=1800

# ==============================================================================
# 📧 PRIMARY EMAIL PROVIDERS (SAMPLE CONFIGURATIONS)
# ==============================================================================
# Resend
RESEND_API_KEY=re_123456789_abcdefg
RESEND_FROM_EMAIL=notifications@yourdomain.com

# SendGrid
SENDGRID_API_KEY=SG.1234567890abcdefghijklmnopqrstuvwxyz
SENDGRID_FROM_EMAIL=alerts@yourdomain.com

# AWS SES
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SES_FROM_EMAIL=system@yourdomain.com

# ==============================================================================
# 📱 PRIMARY SMS & CHAT PROVIDERS (SAMPLE CONFIGURATIONS)
# ==============================================================================
# Twilio (SMS & WhatsApp)
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=1234567890abcdef1234567890abcdef
TWILIO_FROM_NUMBER=+14155552671

# Meta WhatsApp Cloud API (with 24h Session Cost Optimization)
META_WHATSAPP_PHONE_NUMBER_ID=109283746592837
META_WHATSAPP_ACCESS_TOKEN=EAAxxxxxx...
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=convey_wh_verify_secret_123
META_WHATSAPP_APP_SECRET=1234567890abcdef

# ==============================================================================
# 🔔 PUSH & TOOL PROVIDERS (SAMPLE CONFIGURATIONS)
# ==============================================================================
# Firebase Cloud Messaging (FCM v1)
FCM_PROJECT_ID=my-firebase-project
FCM_CLIENT_EMAIL=firebase-adminsdk@my-firebase-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Slack Bot
SLACK_BOT_TOKEN=xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx
SLACK_DEFAULT_CHANNEL=#announcements

# PagerDuty
PAGERDUTY_ROUTING_KEY=1234567890abcdef1234567890abcdef
```
