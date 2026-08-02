# Convey Provider Capabilities & Integration Matrix

Convey integrates **88 external communication providers** across 5 channels (Email, SMS, Push, Chat, Tool).

All providers adhere to the `ProviderAdapter` contract and use dedicated `ProviderTransformer` modules to convert normalized Convey messages into provider-native payloads.

---

## 1. Provider Core Abstractions

- **`ProviderAdapter`**: Base interface implementing `send(message, config, credentials)` and returning normalized `ProviderSendResult` (success, status, error).
- **`ProviderRegistry`**: Dynamic registry that scans environment variables and PostgreSQL `providers` table, resolves active credentials, initializes provider instances, and manages dynamic hot-reloading.
- **`ProviderCircuitBreaker`**: Node-level circuit breaker tracking failure rates. Transitions between `CLOSED`, `OPEN`, and `HALF_OPEN` states. State changes synchronize across cluster nodes via Redis PubSub (`convey:circuit:events`).
- **`SelfHealingEngine`**: Periodically pings degraded providers, running active health probes to automatically recover tripped circuit breakers.
- **`GradualRampController`**: Implements stepped traffic recovery (5% ➔ 20% ➔ 50% ➔ 100%) when circuit breakers transition from `OPEN` to `HALF_OPEN`.

---

## 2. Complete Provider Matrix (88 Providers)

### 📧 Email Providers (20)
| Provider ID | Name | Core Features | Transformer / SDK |
| :--- | :--- | :--- | :--- |
| `ses` | AWS SES v2 | High-volume email, DKIM, template rendering | `@aws-sdk/client-sesv2` |
| `sendgrid` | SendGrid | Transactional & marketing email | `@sendgrid/mail` |
| `resend` | Resend | Developer-first email API | Fetch REST API |
| `mailgun` | Mailgun | Email delivery & webhooks | Fetch REST API |
| `postmark` | Postmark | Ultra-fast transactional email | Fetch REST API |
| `brevo` | Brevo (Sendinblue) | Email & contact management | Fetch REST API |
| `mailjet` | Mailjet | Email templates & tracking | Fetch REST API |
| `sparkpost` | SparkPost | Enterprise email analytics | Fetch REST API |
| `mandrill` | Mailchimp Mandrill | Transactional email | Fetch REST API |
| `mailersend` | MailerSend | Transactional email API | Fetch REST API |
| `nodemailer` | Nodemailer (SMTP) | Custom SMTP transport | SMTP Transport |
| `plunk` | Plunk | Open-source email API | Fetch REST API |
| `mailtrap` | Mailtrap | Sandbox & transactional email | Fetch REST API |
| `anypost` | AnyPost | Generic HTTP POST email adapter | Fetch REST API |
| `braze` | Braze | Customer engagement email | Fetch REST API |
| `emailjs` | EmailJS | Client-side email sending | Fetch REST API |
| `infobip` | Infobip Email | Global email API | Fetch REST API |
| `netcore` | Netcore | Enterprise email | Fetch REST API |
| `outlook365` | Office 365 / Graph | Microsoft Graph Mail API | Fetch REST API |
| `email-webhook` | Custom Email Webhook | Custom HTTP webhook gateway | Fetch REST API |

---

### 📱 SMS Providers (39)
| Provider ID | Name | Channel | Protocol |
| :--- | :--- | :--- | :--- |
| `twilio` | Twilio SMS | SMS | REST API (`twilio` SDK) |
| `nexmo` | Vonage / Nexmo | SMS | REST API |
| `plivo` | Plivo | SMS | REST API |
| `sinch` | Sinch | SMS | REST API |
| `telnyx` | Telnyx | SMS | REST API |
| `termii` | Termii | SMS (Africa/Global) | REST API |
| `bandwidth` | Bandwidth | SMS | REST API |
| `cequens` | Cequens | SMS (MENA/Global) | REST API |
| `infobip` | Infobip SMS | SMS | REST API |
| `messagebird` | MessageBird (Bird) | SMS | REST API |
| `gupshup` | Gupshup | SMS | REST API |
| `clicksend` | ClickSend | SMS | REST API |
| `clickatell` | Clickatell | SMS | REST API |
| `sns` | AWS SNS | SMS | AWS SDK |
| `africas-talking`| Africa's Talking | SMS | REST API |
| `afro-sms` | Afro SMS | SMS | REST API |
| `azure-sms` | Azure Communication | SMS | REST API |
| `brevo-sms` | Brevo SMS | SMS | REST API |
| `bulk-sms` | BulkSMS | SMS | REST API |
| `burst-sms` | Burst SMS | SMS | REST API |
| `cm-telecom` | CM.com | SMS | REST API |
| `eazy-sms` | Eazy SMS | SMS | REST API |
| `firetext` | Firetext | SMS | REST API |
| `forty-six-elks` | 46elks | SMS | REST API |
| `generic-sms` | Generic HTTP SMS | SMS | REST API |
| `imedia` | iMedia | SMS | REST API |
| `isend-sms` | iSend SMS | SMS | REST API |
| `isendpro-sms` | iSendPro SMS | SMS | REST API |
| `kannel` | Kannel Gateway | SMS | HTTP GET/POST |
| `maqsam` | Maqsam | SMS | REST API |
| `mobishastra` | MobiShastra | SMS | REST API |
| `ring-central` | RingCentral | SMS | REST API |
| `ruach-sms` | Ruach SMS | SMS | REST API |
| `sendchamp` | Sendchamp | SMS | REST API |
| `simpletexting` | SimpleTexting | SMS | REST API |
| `sms-central` | SMS Central | SMS | REST API |
| `sms77` | sms77 | SMS | REST API |
| `smsmode` | smsmode | SMS | REST API |
| `unifonic` | Unifonic | SMS | REST API |

---

### 🔔 Push Providers (8)
`fcm` (Firebase Cloud Messaging), `apns` (Apple Push Notification service), `one-signal` (OneSignal), `expo` (Expo Push API), `pusher-beams` (Pusher Beams), `pushpad` (Pushpad), `appio` (Appio Push), `push-webhook` (Custom Push Webhook).

---

### 💬 Chat Providers (17)
`whatsapp-business` (Meta WhatsApp Business API), `twilio-whatsapp` (Twilio WhatsApp), `cequens-whatsapp` (Cequens WhatsApp API), `slack` (`@slack/web-api`), `discord` (Discord Webhooks/Bot), `telegram` (Telegram Bot API), `msTeams` (Microsoft Teams Webhook), `mattermost` (Mattermost Webhook), `line` (LINE Messaging API), `getstream` (GetStream Chat), `grafana-on-call` (Grafana OnCall), `rocket-chat` (Rocket.Chat), `ryver` (Ryver), `sendblue` (Sendblue iMessage), `webex-messaging` (Cisco Webex), `zulip` (Zulip API), `chat-webhook` (Generic Chat Webhook).

---

### 🛠️ Tool & Alerting Providers (4)
`pagerduty` (PagerDuty Events API v2), `opsgenie` (Opsgenie Alert API), `grafana` (Grafana Alerting), `tool-webhook` (Generic Tool Webhook).

---

## 3. Dynamic Credentials & Hot Reloading

Providers can be configured via environment variables OR dynamically populated via PostgreSQL `providers` table rows.

Convey's `listenProviderConfigUpdates()` listens for changes to the `providers` table and immediately updates the in-memory `ProviderRegistry` without requiring service restarts.
