# Convey Provider Capabilities & Integration Matrix

The catalog contains 88 module entries. Native implementation and verification status vary; 20 incomplete SMS implementations are disabled. See the authoritative [provider audit matrix](provider-porting-matrix.md) before enabling a provider.

Modules implement the shared TypeScript adapter interface. Mock fixtures test local behavior only. Webhook ingestion uses the trusted gateway signature contract in [security.md](security.md); native cryptographic verification is not implemented for every vendor.

---

## 1. Provider Core Abstractions & Resilience Architecture

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    ProviderRegistry                    │
                               │   • Loads environment variables & PostgreSQL config    │
                               │   • Hot-reloads dynamically via Redis PubSub           │
                               │   • Memoizes channel adapters for sub-microsecond rout │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                 ProviderCircuitBreaker                 │
                               │   • Per-provider failure rate tracking (10s sliding)   │
                               │   • Tripped breaker broadcasts to cluster via PubSub   │
                               │   • GradualRampController: 5% ➔ 20% ➔ 50% ➔ 100%       │
                               │   • SelfHealingEngine: Background synthetic canaries   │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                    ProviderAdapter                     │
                               │   • Standardized send(message, config, credentials)    │
                               │   • ProviderTransformer: Transforms to native payload  │
                               │   • Normalized error classification & duration timing  │
                               └────────────────────────────────────────────────────────┘
```

---

## 2. Provider Catalog (implementation status varies)

### 📧 Email Providers (20 Adapters)

| Provider ID | Service Name | Protocol / SDK | Delivery Receipts | Webhook Verification | Core Capabilities |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `ses` | Amazon SES v2 | AWS SDK v3 (`@aws-sdk/client-sesv2`) | ✅ | ✅ AWS SNS SigV4 | High-volume transactional, custom DKIM, raw MIME, feedback loops. |
| `sendgrid` | SendGrid | REST API (`@sendgrid/mail`) | ✅ | ✅ ECDSA Public Key | Dynamic templates, ASM unsubscribe groups, open/click tracking. |
| `resend` | Resend | Resend REST API | ✅ | ✅ Svix HMAC-SHA256 | Developer-first email, React email components, custom domains. |
| `mailgun` | Mailgun | Mailgun v3 REST | ✅ | ✅ HMAC-SHA256 | Tagging, analytics, scheduled delivery, DKIM/SPF management. |
| `postmark` | Postmark | Postmark REST | ✅ | ✅ Secret Token / Basic | Ultra-fast transactional delivery, bounce categorization. |
| `brevo` | Brevo (Sendinblue) | Brevo v3 REST | ✅ | ✅ Webhook Signature | Transactional templates, contact attribute syncing. |
| `mailjet` | Mailjet | Mailjet v3.1 REST | ✅ | ✅ Basic / Token | High-throughput European transactional email, GDPR compliant. |
| `sparkpost` | SparkPost | SparkPost v1 REST | ✅ | ✅ OAuth / Token | Enterprise analytics, recipient lists, IP pools. |
| `mandrill` | Mailchimp Mandrill | Mandrill REST | ✅ | ✅ HMAC-SHA1 Signature | Merge variables, template rendering, subaccount routing. |
| `mailersend` | MailerSend | MailerSend REST | ✅ | ✅ Signature Token | Transactional email, suppression list synchronization. |
| `nodemailer` | SMTP (Generic) | Nodemailer Transport | ❌ | N/A | Direct SMTP transport for on-premises mail relays (Postfix, Exim). |
| `plunk` | Plunk | Plunk Secret API | ✅ | ✅ Secret Header | Lightweight open-source transactional email. |
| `mailtrap` | Mailtrap | Mailtrap Email API | ✅ | ✅ Webhook Token | Sandbox testing and production transactional sending. |
| `anypost` | Anypost | Custom HTTP POST | ✅ | ✅ Secret Token | Configurable generic HTTP POST gateway adapter. |
| `braze` | Braze | Braze REST API | ✅ | ✅ Custom Webhook | Customer engagement email campaigns with user aliases. |
| `emailjs` | EmailJS | EmailJS API | ❌ | N/A | Serverless email dispatch without direct SMTP credentials. |
| `infobip` | Infobip Email | Infobip Omnichannel | ✅ | ✅ HMAC-SHA256 | Global enterprise delivery, multi-channel failover fallback. |
| `netcore` | Netcore | Netcore Pepipost | ✅ | ✅ Webhook Token | Enterprise transactional email delivery with custom subaccounts. |
| `outlook365` | Microsoft 365 | Microsoft Graph API | ❌ | ✅ Graph Validation Token | Native corporate email delivery via Office 365 Graph API. |
| `email-webhook`| Generic Email Webhook | Custom HTTP POST | ✅ | ✅ HMAC Signature | Custom upstream webhook gateway endpoint. |

---

### 📱 SMS Providers (39 Adapters)

| Provider ID | Service Name | Protocol | Webhook Auth | Geographic Focus |
| :--- | :--- | :--- | :---: | :--- |
| `twilio` | Twilio SMS | REST API (`twilio` SDK) | ✅ HMAC-SHA1 | Global |
| `nexmo` | Vonage (Nexmo) | REST API | ✅ Signature Secret | Global |
| `plivo` | Plivo | REST API | ✅ HMAC-SHA256 | Global / US / India |
| `sinch` | Sinch SMS | REST API | ✅ Bearer Token | Global |
| `telnyx` | Telnyx | REST API | ✅ Ed25519 Public Key | Global / North America |
| `termii` | Termii | REST API | ✅ Secret Token | Africa / Global |
| `bandwidth` | Bandwidth | REST API | ✅ Basic Auth | North America |
| `cequens` | Cequens | REST API | ✅ Bearer Token | Middle East / North Africa |
| `infobip` | Infobip SMS | REST API | ✅ HMAC-SHA256 | Global Enterprise |
| `messagebird` | MessageBird (Bird) | REST API | ✅ HMAC-SHA256 | Global / Europe |
| `gupshup` | Gupshup | REST API | ✅ Basic Auth | India / LATAM / Global |
| `clicksend` | ClickSend | REST API | ✅ Basic Auth | Global / APAC |
| `clickatell` | Clickatell | REST API | ✅ Token Auth | Global / Africa |
| `sns` | AWS SNS | AWS SDK (`@aws-sdk/client-sns`) | ✅ AWS SigV4 | Global Cloud |
| `africas-talking`| Africa's Talking | REST API | ✅ API Key | Africa |
| `afro-sms` | Afro SMS | REST API | ✅ Token Auth | Africa |
| `azure-sms` | Azure Communication | Azure REST | ✅ HMAC-SHA256 | Global Enterprise |
| `brevo-sms` | Brevo SMS | REST API | ✅ API Key | Europe / Global |
| `bulk-sms` | BulkSMS | REST API | ✅ Basic Auth | Global |
| `burst-sms` | Burst SMS | REST API | ✅ API Key | Australia / APAC |
| `cm-telecom` | CM.com | REST API | ✅ Bearer Token | Europe / Global |
| `eazy-sms` | Eazy SMS | REST API | ✅ API Key | Middle East |
| `firetext` | Firetext | REST API | ✅ Token Auth | United Kingdom |
| `forty-six-elks`| 46elks | REST API | ✅ Basic Auth | Europe / Nordics |
| `generic-sms` | Generic HTTP SMS | Custom HTTP POST | ✅ HMAC / Secret | Configurable |
| `imedia` | iMedia | REST API | ✅ API Key | Middle East |
| `isend-sms` | iSend SMS | REST API | ✅ API Key | Latin America |
| `isendpro-sms` | iSendPro SMS | REST API | ✅ API Key | France / Europe |
| `kannel` | Kannel Gateway | HTTP GET/POST | ✅ Basic Auth | Self-hosted SMS Gateway |
| `maqsam` | Maqsam | REST API | ✅ Token Auth | Middle East |
| `mobishastra` | MobiShastra | REST API | ✅ Basic Auth | Middle East / India |
| `ring-central` | RingCentral | REST API | ✅ OAuth 2.0 | North America |
| `ruach-sms` | Ruach SMS | REST API | ✅ API Key | Africa |
| `sendchamp` | Sendchamp | REST API | ✅ Bearer Token | Africa |
| `simpletexting` | SimpleTexting | REST API | ✅ API Key | North America |
| `sms-central` | SMS Central | REST API | ✅ Basic Auth | Australia |
| `sms77` | sms77 | REST API | ✅ Bearer Token | Germany / Europe |
| `smsmode` | smsmode | REST API | ✅ Access Token | France / Europe |
| `unifonic` | Unifonic | REST API | ✅ Bearer Token | Middle East |

---

### 🔔 Push Notification Providers (8 Adapters)

| Provider ID | Name | Protocol / Engine | Features |
| :--- | :--- | :--- | :--- |
| `fcm` | Firebase Cloud Messaging | FCM HTTP v1 REST | Android/iOS/Web push, high-priority data messages, topics. |
| `apns` | Apple Push Notification | HTTP/2 APNs Protocol | iOS/macOS/watchOS native push, token-based (.p8) auth, VoIP alerts. |
| `one-signal` | OneSignal | OneSignal REST API | Cross-platform push, player tags, segments, action buttons. |
| `expo` | Expo Push API | Expo Push REST | React Native Expo notification receipts, ticket tracking. |
| `pusher-beams`| Pusher Beams | Beams REST API | Real-time push, authenticated user IDs, interest subscriptions. |
| `pushpad` | Pushpad | Pushpad REST API | Web push notifications (Chrome, Firefox, Safari, Edge). |
| `appio` | Appio Push | Appio REST API | Enterprise mobile push gateway. |
| `push-webhook`| Generic Push Webhook | Custom HTTP POST | Configurable push gateway with HMAC validation. |

---

### 💬 Chat & Instant Messaging Providers (17 Adapters)

| Provider ID | Name | Protocol | Features & Optimization |
| :--- | :--- | :--- | :--- |
| `whatsapp-business`| Meta WhatsApp Cloud API | Graph API v19+ | Official WhatsApp Business API, **24h Session Cost Optimizer ($0.00 Text)**. |
| `twilio-whatsapp` | Twilio WhatsApp | REST API | WhatsApp messaging via Twilio Sandbox/Production numbers. |
| `cequens-whatsapp` | Cequens WhatsApp | REST API | Direct MENA WhatsApp Business solution provider. |
| `slack` | Slack API | `@slack/web-api` | Bot messages, interactive Block Kit layouts, channel broadcasting. |
| `discord` | Discord Webhooks/Bot | REST API | Embed layouts, markdown formatting, webhook token execution. |
| `telegram` | Telegram Bot API | Telegram Bot REST | HTML/Markdown parsing, inline keyboard buttons, chat broadcasting. |
| `msTeams` | Microsoft Teams | Teams Webhook / Graph | Adaptive Cards, channel notifications, Actionable Messages. |
| `mattermost` | Mattermost | Mattermost REST | Self-hosted enterprise team chat messaging. |
| `line` | LINE Messaging API | LINE Messaging REST | Flex messages, quick replies, broadcast messaging. |
| `getstream` | Stream Chat | GetStream REST | In-app user-to-user and channel chat messaging. |
| `grafana-on-call` | Grafana OnCall | OnCall REST | Real-time incident escalation chat alerts. |
| `rocket-chat` | Rocket.Chat | Rocket.Chat REST | Open-source enterprise chat platform messaging. |
| `ryver` | Ryver | Ryver Webhook | Enterprise team collaboration chat alerts. |
| `sendblue` | Sendblue | Sendblue REST | Native Apple iMessage and SMS dispatch API. |
| `webex-messaging` | Cisco Webex | Webex REST API | Cisco Webex Teams spaces and direct user messaging. |
| `zulip` | Zulip | Zulip REST API | Topic-based team stream messaging. |
| `chat-webhook` | Generic Chat Webhook | Custom HTTP POST | Configurable chat gateway with HMAC signatures. |

---

### 🛠️ Alerting & Tooling Providers (4 Adapters)

| Provider ID | Name | Protocol | Capabilities |
| :--- | :--- | :--- | :--- |
| `pagerduty` | PagerDuty | Events API v2 | Deduplicated incident triggers, acknowledgments, resolutions, severity routing. |
| `opsgenie` | Opsgenie | Alerts API v2 | Critical alert creation, responder routing, priority overrides. |
| `grafana` | Grafana Alertmanager | Alertmanager REST | Prometheus/Grafana alert notification ingestion. |
| `tool-webhook` | Generic Tool Webhook | Custom HTTP POST | Configurable infrastructure alerting gateway. |

---

## 3. Dynamic Configuration & Hot-Reloading

Provider credentials and settings can be configured via environment variables or managed dynamically in the PostgreSQL `providers` table.

Convey's `DynamicConfigReloader` (`src/config/dynamic-reloader.ts`) listens to Redis PubSub updates:
1. An administrator or API modifies a provider in PostgreSQL.
2. An event is published to Redis channel `convey:config:reload`.
3. All running Convey nodes invalidate their in-memory provider cache (`providerConfigCache.delete(providerId)`) and re-instantiate adapters in **`< 1ms`** without worker restarts.
