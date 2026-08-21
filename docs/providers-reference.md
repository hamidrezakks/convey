# Convey Comprehensive Provider Reference & Integration Manual

Convey provides first-class native integration with **88 external communication providers** across 5 distinct channels:
- 📧 **Email Channel** (20 Turnkey Adapters)
- 📱 **SMS Channel** (39 Turnkey Adapters)
- 🔔 **Push Notifications Channel** (8 Turnkey Adapters)
- 💬 **Chat & Instant Messaging Channel** (17 Turnkey Adapters)
- 🛠️ **Tool & Infrastructure Alerting Channel** (4 Turnkey Adapters)

Every provider is implemented as a 100% standalone, zero-dependency TypeScript module under `apps/server/src/modules/providers/<channel>/<provider-id>/` conforming to the unified `ProviderAdapter` and `ProviderModule` contracts.

---

## 1. Provider Architectural Principles & Operational Guarantees

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PROVIDER REGISTRY & LIFECYCLE                                    │
│   • Dynamic Hot-Reloading: Redis PubSub (convey:config:reload) invalidates L1 cache in < 1ms          │
│   • Dual-Tier Configuration: Static Environment Variables (fallback) + PostgreSQL Dynamic Storage     │
│   • Channel Memoization: Pre-indexed channel lookup eliminates manifest iteration                     │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  RESILIENCE & TRAFFIC GOVERNANCE                                       │
│   • Provider Circuit Breakers: Sliding window failure rate (10s) with cluster-wide PubSub broadcast    │
│   • Stepped Half-Open Traffic Ramp: 5% ➔ 20% ➔ 50% ➔ 100% progressive canary admission                  │
│   • Leaky-Bucket Micro-Pacing: Per-provider token rate limiting (100ms slices) to respect API caps     │
│   • Dynamic Hedged Requests: Tail latency mitigation for p95 latency spikes                            │
│   • Synthetic Canary Self-Healing: Background probes evaluate degraded providers before traffic restore│
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       ADAPTER EXECUTION LAYER                                          │
│   • Standardized Send Interface: send(message, config, credentials) -> Promise<ProviderSendResult>     │
│   • Native Payload Transformation: Strict ISO payload normalization with vendor-specific extensions    │
│   • Deterministic Error Classification: Mapped to TRANSIENT, TERMINAL_PROVIDER, or TERMINAL_RECIPIENT  │
│   • Cryptographic Inbound Webhook Verification: HMAC-SHA256, Ed25519, ECDSA, AWS SigV4 validation     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration Precedence & Universal Resolution

For any provider integration, credentials and parameters are resolved using the following order of precedence:

1. **Database Dynamic Configuration (`providers` table in PostgreSQL)**: Highest priority. Managed via the REST API (`POST /v1/admin/providers/register`) or Mission Control Web-UI.
2. **Dedicated Environment Variables (`<KEY>`)**: Standard vendor-specific variables (e.g. `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`).
3. **Generic Prefixed Environment Variables (`PROVIDER_<ID>_<KEY>`)**: Universal namespaced fallback format (e.g. `PROVIDER_SENDGRID_API_KEY`, `PROVIDER_TWILIO_AUTH_TOKEN`).

---

## 3. Email Channel Providers (20 Adapters)

### 3.1 `ses` — Amazon Simple Email Service (SES v2)
- **Channel**: `EMAIL`
- **Protocol / SDK**: AWS SDK v3 (`@aws-sdk/client-sesv2`)
- **Delivery Receipts**: Yes (via AWS SNS Webhook notification)
- **Webhook Verification**: AWS SNS SigV4 Cryptographic Signature
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `AWS_SES_REGION` | Yes | String | AWS Region (e.g. `us-east-1`, `eu-west-1`) |
  | `AWS_ACCESS_KEY_ID` | Yes | String | IAM User/Role Access Key ID |
  | `AWS_SECRET_ACCESS_KEY` | Yes | Secret | IAM Secret Access Key |
  | `AWS_SES_FROM_EMAIL` | Yes | String | Verified SES identity email or domain |
- **Feature Configs**: `openTracking`, `clickTracking`, `tlsPolicy` (`'REQUIRE' | 'OPTIONAL'`).

### 3.2 `sendgrid` — Twilio SendGrid
- **Channel**: `EMAIL`
- **Protocol**: SendGrid v3 REST API (`@sendgrid/mail`)
- **Delivery Receipts**: Yes (Real-time Event Webhook)
- **Webhook Verification**: ECDSA Public Key (`X-Twilio-Email-Event-Webhook-Signature`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `SENDGRID_API_KEY` | Yes | Secret | SendGrid API Key (`SG.xxx...`) with Mail Send permissions |
  | `SENDGRID_FROM_EMAIL` | Yes | String | Verified sender domain email address |
  | `SENDGRID_WEBHOOK_SECRET` | No | Secret | ECDSA Public Key for webhook signature validation |
- **Feature Configs**: `ipPoolName`, `asmGroupId` (Unsubscribe group ID), `clickTracking`, `openTracking`.

### 3.3 `resend` — Resend
- **Channel**: `EMAIL`
- **Protocol**: Resend REST API v1
- **Delivery Receipts**: Yes (Svix Webhooks)
- **Webhook Verification**: Svix HMAC-SHA256 (`svix-signature`, `svix-timestamp`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `RESEND_API_KEY` | Yes | Secret | Resend API Key (`re_xxx...`) |
  | `RESEND_FROM_EMAIL` | Yes | String | Verified domain sender email |
  | `RESEND_WEBHOOK_SECRET` | No | Secret | Svix webhook signing secret (`whsec_xxx...`) |
- **Feature Configs**: `tags`, `headers`.

### 3.4 `mailgun` — Mailgun
- **Channel**: `EMAIL`
- **Protocol**: Mailgun v3 REST API
- **Delivery Receipts**: Yes (Event Webhooks)
- **Webhook Verification**: HMAC-SHA256 Signature (`signature.token`, `signature.timestamp`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `MAILGUN_API_KEY` | Yes | Secret | Mailgun Private API Key |
  | `MAILGUN_DOMAIN` | Yes | String | Sending domain registered with Mailgun |
  | `MAILGUN_BASE_URL` | No | String | Base API URL (`https://api.mailgun.net` or `https://api.eu.mailgun.net`) |
  | `MAILGUN_FROM_EMAIL` | Yes | String | Verified sender address |
  | `MAILGUN_WEBHOOK_SECRET`| No | Secret | Webhook signing key for cryptographic verification |

### 3.5 `postmark` — Postmark
- **Channel**: `EMAIL`
- **Protocol**: Postmark Server REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: HTTP Basic Auth / Header Secret Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `POSTMARK_SERVER_TOKEN` | Yes | Secret | Postmark Server API Token |
  | `POSTMARK_FROM_EMAIL` | Yes | String | Sender Signature or verified domain |
  | `POSTMARK_MESSAGE_STREAM`| No | String | Message stream ID (default: `outbound`) |
  | `POSTMARK_WEBHOOK_SECRET`| No | Secret | Webhook secret token |

### 3.6 `brevo` — Brevo (formerly Sendinblue)
- **Channel**: `EMAIL`
- **Protocol**: Brevo v3 REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Webhook Signature Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `BREVO_API_KEY` | Yes | Secret | Brevo v3 API Key (`xkeysib-xxx...`) |
  | `BREVO_FROM_EMAIL` | Yes | String | Authenticated sender email |
  | `BREVO_WEBHOOK_SECRET` | No | Secret | Webhook verification token |

### 3.7 `mailjet` — Mailjet
- **Channel**: `EMAIL`
- **Protocol**: Mailjet v3.1 REST API
- **Delivery Receipts**: Yes (Event API)
- **Webhook Verification**: Basic Auth / Query Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `MAILJET_API_KEY` | Yes | String | Mailjet Public API Key |
  | `MAILJET_SECRET_KEY` | Yes | Secret | Mailjet Secret API Key |
  | `MAILJET_FROM_EMAIL` | Yes | String | Validated sender email address |

### 3.8 `sparkpost` — SparkPost
- **Channel**: `EMAIL`
- **Protocol**: SparkPost v1 REST API
- **Delivery Receipts**: Yes (Message Events Webhook)
- **Webhook Verification**: OAuth 2.0 / Shared Secret Header (`X-MessageSystems-Webhook-Token`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `SPARKPOST_API_KEY` | Yes | Secret | SparkPost REST API Key |
  | `SPARKPOST_ENDPOINT` | No | String | API endpoint (`https://api.sparkpost.com` or `https://api.eu.sparkpost.com`) |
  | `SPARKPOST_FROM_EMAIL` | Yes | String | Verified sending domain address |

### 3.9 `mandrill` — Mailchimp Transactional (Mandrill)
- **Channel**: `EMAIL`
- **Protocol**: Mandrill REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: HMAC-SHA1 Signature (`X-Mandrill-Signature`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `MANDRILL_API_KEY` | Yes | Secret | Mandrill API Key |
  | `MANDRILL_FROM_EMAIL` | Yes | String | Sender email address |
  | `MANDRILL_SUBACCOUNT` | No | String | Mandrill subaccount identifier |
  | `MANDRILL_WEBHOOK_KEY` | No | Secret | Webhook authentication key |

### 3.10 `mailersend` — MailerSend
- **Channel**: `EMAIL`
- **Protocol**: MailerSend REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Signature Header Verification
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `MAILERSEND_API_KEY` | Yes | Secret | MailerSend Bearer API Token |
  | `MAILERSEND_FROM_EMAIL` | Yes | String | Verified domain sender email |
  | `MAILERSEND_WEBHOOK_SECRET`| No | Secret | Webhook signing key |

### 3.11 `nodemailer` — Generic SMTP Relay
- **Channel**: `EMAIL`
- **Protocol**: Direct SMTP / SMTPS via Nodemailer
- **Delivery Receipts**: No (Standard SMTP handshake confirmation)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `SMTP_HOST` | Yes | String | SMTP Relay Server Hostname (e.g. `smtp.mailgun.org`, `localhost`) |
  | `SMTP_PORT` | Yes | Number | SMTP Port (`587` for STARTTLS, `465` for TLS, `25` for plaintext) |
  | `SMTP_USER` | No | String | SMTP Username / Authentication Identity |
  | `SMTP_PASS` | No | Secret | SMTP Password / Token |
  | `SMTP_SECURE` | No | Boolean | Force TLS encryption (`true` for port 465) |
  | `SMTP_FROM_EMAIL` | Yes | String | Default Envelope `From` address |

### 3.12 `plunk` — Plunk
- **Channel**: `EMAIL`
- **Protocol**: Plunk Secret API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Header Secret (`x-plunk-secret`)
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `PLUNK_API_KEY` | Yes | Secret | Plunk Secret API Key |
  | `PLUNK_FROM_EMAIL` | Yes | String | Sender email address |

### 3.13 `mailtrap` — Mailtrap Email API
- **Channel**: `EMAIL`
- **Protocol**: Mailtrap REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Webhook Verification Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `MAILTRAP_API_KEY` | Yes | Secret | Mailtrap API Token |
  | `MAILTRAP_INBOX_ID` | No | String | Testing sandbox inbox ID (if using Sandbox) |
  | `MAILTRAP_FROM_EMAIL` | Yes | String | Verified sending domain email |

### 3.14 `anypost` — Anypost Custom HTTP POST
- **Channel**: `EMAIL`
- **Protocol**: Configurable HTTP POST Gateway
- **Delivery Receipts**: Yes
- **Webhook Verification**: Header Secret Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `ANYPOST_URL` | Yes | String | Target outbound HTTP endpoint |
  | `ANYPOST_API_KEY` | No | Secret | Bearer or Custom Header Token |
  | `ANYPOST_FROM_EMAIL` | Yes | String | Sender email address |

### 3.15 `braze` — Braze Email
- **Channel**: `EMAIL`
- **Protocol**: Braze REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Custom Webhook Secret
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `BRAZE_API_KEY` | Yes | Secret | Braze REST API Key |
  | `BRAZE_INSTANCE_URL` | Yes | String | Braze REST Endpoint URL (e.g. `https://rest.iad-01.braze.com`) |
  | `BRAZE_APP_ID` | Yes | String | Braze App Identifier |
  | `BRAZE_FROM_EMAIL` | Yes | String | Verified sender email |

### 3.16 `emailjs` — EmailJS
- **Channel**: `EMAIL`
- **Protocol**: EmailJS REST API
- **Delivery Receipts**: No
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `EMAILJS_SERVICE_ID` | Yes | String | EmailJS Service ID |
  | `EMAILJS_TEMPLATE_ID` | Yes | String | Default Template ID |
  | `EMAILJS_USER_ID` | Yes | String | Public Key / User ID |
  | `EMAILJS_ACCESS_TOKEN` | Yes | Secret | Private API Access Token |

### 3.17 `infobip` (Email) — Infobip Email
- **Channel**: `EMAIL`
- **Protocol**: Infobip Omnichannel REST API
- **Delivery Receipts**: Yes
- **Webhook Verification**: HMAC-SHA256 Signature
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `INFOBIP_API_KEY` | Yes | Secret | Infobip API Key |
  | `INFOBIP_BASE_URL` | Yes | String | Custom Base URL (e.g. `https://xxxx.api.infobip.com`) |
  | `INFOBIP_FROM_EMAIL` | Yes | String | Registered sender email |

### 3.18 `netcore` — Netcore (Pepipost)
- **Channel**: `EMAIL`
- **Protocol**: Netcore Cloud Email API
- **Delivery Receipts**: Yes
- **Webhook Verification**: Webhook Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `NETCORE_API_KEY` | Yes | Secret | Netcore Send API Key |
  | `NETCORE_FROM_EMAIL` | Yes | String | Verified domain email address |

### 3.19 `outlook365` — Microsoft 365 / Office 365
- **Channel**: `EMAIL`
- **Protocol**: Microsoft Graph API v1.0
- **Delivery Receipts**: No
- **Webhook Verification**: Azure Graph Validation Token
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `OUTLOOK_TENANT_ID` | Yes | String | Azure Active Directory Tenant ID |
  | `OUTLOOK_CLIENT_ID` | Yes | String | App Registration Client ID |
  | `OUTLOOK_CLIENT_SECRET`| Yes | Secret | App Registration Client Secret |
  | `OUTLOOK_FROM_EMAIL` | Yes | String | Corporate Mailbox Address |

### 3.20 `email-webhook` — Generic Email Webhook Gateway
- **Channel**: `EMAIL`
- **Protocol**: Custom HTTP/HTTPS POST
- **Delivery Receipts**: Yes
- **Webhook Verification**: HMAC-SHA256 Signature
- **Environment Variables**:
  | Variable Key | Required | Type | Description |
  | :--- | :---: | :---: | :--- |
  | `EMAIL_WEBHOOK_URL` | Yes | String | Upstream HTTP endpoint URL |
  | `EMAIL_WEBHOOK_SECRET` | No | Secret | HMAC secret key |
  | `EMAIL_WEBHOOK_FROM` | Yes | String | Default sender identification |

---

## 4. SMS Channel Providers (39 Adapters)

### 4.1 `twilio` — Twilio SMS
- **Protocol**: Twilio REST API
- **Environment Variables**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **Webhook Verification**: HMAC-SHA1 (`X-Twilio-Signature`)

### 4.2 `nexmo` — Vonage (Nexmo)
- **Protocol**: Vonage SMS REST API
- **Environment Variables**: `NEXMO_API_KEY`, `NEXMO_API_SECRET`, `NEXMO_FROM_NUMBER`
- **Webhook Verification**: Signature Secret / MD5 / HMAC

### 4.3 `plivo` — Plivo SMS
- **Protocol**: Plivo REST API v1
- **Environment Variables**: `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_FROM_NUMBER`
- **Webhook Verification**: HMAC-SHA256 (`X-Plivo-Signature-V2`)

### 4.4 `sinch` — Sinch SMS
- **Protocol**: Sinch REST API
- **Environment Variables**: `SINCH_SERVICE_PLAN_ID`, `SINCH_API_TOKEN`, `SINCH_FROM_NUMBER`
- **Webhook Verification**: Bearer Token Authorization

### 4.5 `telnyx` — Telnyx
- **Protocol**: Telnyx v2 REST API
- **Environment Variables**: `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`, `TELNYX_PUBLIC_KEY`
- **Webhook Verification**: Ed25519 Public Key Signature

### 4.6 `termii` — Termii
- **Protocol**: Termii REST API
- **Environment Variables**: `TERMII_API_KEY`, `TERMII_FROM_NAME`
- **Webhook Verification**: Secret Token

### 4.7 `bandwidth` — Bandwidth SMS
- **Protocol**: Bandwidth v2 REST API
- **Environment Variables**: `BANDWIDTH_ACCOUNT_ID`, `BANDWIDTH_API_TOKEN`, `BANDWIDTH_API_SECRET`, `BANDWIDTH_APPLICATION_ID`, `BANDWIDTH_FROM_NUMBER`
- **Webhook Verification**: HTTP Basic Auth

### 4.8 `cequens` — Cequens SMS
- **Protocol**: Cequens REST API
- **Environment Variables**: `CEQUENS_API_KEY`, `CEQUENS_FROM_NAME`
- **Webhook Verification**: Bearer Token

### 4.9 `messagebird` — Bird (MessageBird)
- **Protocol**: MessageBird REST API
- **Environment Variables**: `MESSAGEBIRD_API_KEY`, `MESSAGEBIRD_FROM_NAME`
- **Webhook Verification**: HMAC-SHA256 (`MessageBird-Signature`)

### 4.10 `gupshup` — Gupshup Enterprise SMS
- **Protocol**: Gupshup Enterprise REST API
- **Environment Variables**: `GUPSHUP_USER_ID`, `GUPSHUP_PASSWORD`, `GUPSHUP_FROM_NAME`
- **Webhook Verification**: Basic Auth

### 4.11 `clicksend` — ClickSend SMS
- **Protocol**: ClickSend v3 REST API
- **Environment Variables**: `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`, `CLICKSEND_FROM`
- **Webhook Verification**: Basic Auth

### 4.12 `clickatell` — Clickatell REST API
- **Protocol**: Clickatell REST API
- **Environment Variables**: `CLICKATELL_API_KEY`, `CLICKATELL_FROM`
- **Webhook Verification**: Token Auth

### 4.13 `sns` — Amazon Simple Notification Service (SNS SMS)
- **Protocol**: AWS SDK v3 (`@aws-sdk/client-sns`)
- **Environment Variables**: `AWS_SNS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Webhook Verification**: AWS SNS SigV4 Signature

### 4.14 `africas-talking` — Africa's Talking
- **Protocol**: Africa's Talking REST API
- **Environment Variables**: `AFRICAS_TALKING_USERNAME`, `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_FROM`
- **Webhook Verification**: API Key Header

### 4.15 `afro-sms` — Afro SMS
- **Protocol**: Afro SMS REST API
- **Environment Variables**: `AFRO_SMS_API_KEY`, `AFRO_SMS_SENDER_ID`
- **Webhook Verification**: Token Auth

### 4.16 `azure-sms` — Azure Communication Services SMS
- **Protocol**: Azure REST API / SDK
- **Environment Variables**: `AZURE_COMMUNICATION_CONNECTION_STRING`, `AZURE_SMS_FROM_NUMBER`
- **Webhook Verification**: HMAC-SHA256 Event Grid Auth

### 4.17 `brevo-sms` — Brevo SMS
- **Protocol**: Brevo Transactional SMS REST API
- **Environment Variables**: `BREVO_SMS_API_KEY`, `BREVO_SMS_SENDER`
- **Webhook Verification**: API Key

### 4.18 `bulk-sms` — BulkSMS
- **Protocol**: BulkSMS JSON REST API
- **Environment Variables**: `BULK_SMS_API_ID`, `BULK_SMS_PASSWORD`, `BULK_SMS_FROM`
- **Webhook Verification**: Basic Auth

### 4.19 `burst-sms` — Burst SMS
- **Protocol**: Burst SMS REST API
- **Environment Variables**: `BURST_SMS_API_KEY`, `BURST_SMS_API_SECRET`, `BURST_SMS_FROM`
- **Webhook Verification**: API Key

### 4.20 `cm-telecom` — CM.com
- **Protocol**: CM.com Messaging Gateway REST API
- **Environment Variables**: `CM_TELECOM_API_KEY`, `CM_TELECOM_FROM`
- **Webhook Verification**: Bearer Token

### 4.21 `eazy-sms` — Eazy SMS
- **Protocol**: Eazy SMS REST API
- **Environment Variables**: `EAZY_SMS_API_KEY`, `EAZY_SMS_SENDER_ID`
- **Webhook Verification**: API Key

### 4.22 `firetext` — Firetext UK SMS
- **Protocol**: Firetext REST API
- **Environment Variables**: `FIRETEXT_API_KEY`, `FIRETEXT_FROM`
- **Webhook Verification**: Token Auth

### 4.23 `forty-six-elks` — 46elks SMS
- **Protocol**: 46elks REST API
- **Environment Variables**: `FORTY_SIX_ELKS_USER`, `FORTY_SIX_ELKS_PASS`, `FORTY_SIX_ELKS_FROM`
- **Webhook Verification**: Basic Auth

### 4.24 `generic-sms` — Generic HTTP SMS Gateway
- **Protocol**: Configurable HTTP POST Gateway
- **Environment Variables**: `GENERIC_SMS_URL`, `GENERIC_SMS_TOKEN`, `GENERIC_SMS_FROM`
- **Webhook Verification**: HMAC / Secret

### 4.25 `imedia` — iMedia SMS
- **Protocol**: iMedia Middle East REST API
- **Environment Variables**: `IMEDIA_USER_NAME`, `IMEDIA_PASSWORD`, `IMEDIA_SENDER_ID`
- **Webhook Verification**: API Key / Token

### 4.26 `isend-sms` — iSend SMS
- **Protocol**: iSend SMS REST API
- **Environment Variables**: `ISEND_SMS_API_KEY`, `ISEND_SMS_SENDER`
- **Webhook Verification**: API Key

### 4.27 `isendpro-sms` — iSendPro SMS
- **Protocol**: iSendPro France REST API
- **Environment Variables**: `ISENDPRO_API_KEY`, `ISENDPRO_SENDER`
- **Webhook Verification**: API Key

### 4.28 `kannel` — Kannel SMS Gateway
- **Protocol**: Kannel Bearerbox HTTP Gateway
- **Environment Variables**: `KANNEL_HOST`, `KANNEL_PORT`, `KANNEL_USERNAME`, `KANNEL_PASSWORD`, `KANNEL_SENDER_ID`
- **Webhook Verification**: HTTP Basic Auth

### 4.29 `maqsam` — Maqsam SMS
- **Protocol**: Maqsam Cloud Telephony REST API
- **Environment Variables**: `MAQSAM_ACCESS_KEY`, `MAQSAM_ACCESS_SECRET`, `MAQSAM_FROM_NUMBER`
- **Webhook Verification**: Token Auth

### 4.30 `mobishastra` — MobiShastra SMS
- **Protocol**: MobiShastra Enterprise REST API
- **Environment Variables**: `MOBISHASTRA_USER`, `MOBISHASTRA_PASSWORD`, `MOBISHASTRA_SENDER_ID`
- **Webhook Verification**: Basic Auth

### 4.31 `ring-central` — RingCentral SMS
- **Protocol**: RingCentral REST API
- **Environment Variables**: `RINGCENTRAL_CLIENT_ID`, `RINGCENTRAL_CLIENT_SECRET`, `RINGCENTRAL_JWT`, `RINGCENTRAL_FROM`
- **Webhook Verification**: OAuth 2.0

### 4.32 `ruach-sms` — Ruach SMS
- **Protocol**: Ruach SMS Gateway REST API
- **Environment Variables**: `RUACH_SMS_API_KEY`, `RUACH_SMS_SENDER_ID`
- **Webhook Verification**: API Key

### 4.33 `sendchamp` — Sendchamp SMS
- **Protocol**: Sendchamp REST API
- **Environment Variables**: `SENDCHAMP_PUBLIC_KEY`, `SENDCHAMP_FROM_NAME`
- **Webhook Verification**: Bearer Token

### 4.34 `simpletexting` — SimpleTexting SMS
- **Protocol**: SimpleTexting REST API v2
- **Environment Variables**: `SIMPLETEXTING_API_KEY`, `SIMPLETEXTING_FROM`
- **Webhook Verification**: API Key

### 4.35 `sms-central` — SMS Central Australia
- **Protocol**: SMS Central REST API
- **Environment Variables**: `SMS_CENTRAL_USERNAME`, `SMS_CENTRAL_PASSWORD`, `SMS_CENTRAL_FROM`
- **Webhook Verification**: Basic Auth

### 4.36 `sms77` — sms77.io
- **Protocol**: sms77 REST API
- **Environment Variables**: `SMS77_API_KEY`, `SMS77_FROM`
- **Webhook Verification**: Bearer Token

### 4.37 `smsmode` — smsmode France
- **Protocol**: smsmode REST API
- **Environment Variables**: `SMSMODE_API_KEY`, `SMSMODE_FROM`
- **Webhook Verification**: Access Token

### 4.38 `unifonic` — Unifonic SMS
- **Protocol**: Unifonic Messaging REST API
- **Environment Variables**: `UNIFONIC_APP_SID`, `UNIFONIC_FROM_NAME`
- **Webhook Verification**: Bearer Token

### 4.39 `infobip` (SMS) — Infobip SMS
- **Protocol**: Infobip Omnichannel REST API
- **Environment Variables**: `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_FROM_NUMBER`
- **Webhook Verification**: HMAC-SHA256

---

## 5. Push Notification Channel Providers (8 Adapters)

### 5.1 `fcm` — Firebase Cloud Messaging (HTTP v1)
- **Protocol**: Google FCM HTTP v1 REST
- **Environment Variables**: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`

### 5.2 `apns` — Apple Push Notification Service (HTTP/2)
- **Protocol**: Direct APNs HTTP/2 Protocol
- **Environment Variables**: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_P8_CERT`, `APNS_BUNDLE_ID`, `APNS_IS_PRODUCTION`

### 5.3 `one-signal` — OneSignal
- **Protocol**: OneSignal REST API v1
- **Environment Variables**: `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

### 5.4 `expo` — Expo Push API
- **Protocol**: Expo Push HTTP/2 Gateway
- **Environment Variables**: `EXPO_ACCESS_TOKEN`

### 5.5 `pusher-beams` — Pusher Beams
- **Protocol**: Beams Publish REST API
- **Environment Variables**: `PUSHER_BEAMS_INSTANCE_ID`, `PUSHER_BEAMS_SECRET_KEY`

### 5.6 `pushpad` — Pushpad Web Push
- **Protocol**: Pushpad REST API
- **Environment Variables**: `PUSHPAD_PROJECT_ID`, `PUSHPAD_AUTH_TOKEN`

### 5.7 `appio` — Appio Push
- **Protocol**: Appio REST API
- **Environment Variables**: `APPIO_API_KEY`, `APPIO_APP_ID`

### 5.8 `push-webhook` — Generic Push Webhook
- **Protocol**: Custom HTTP POST
- **Environment Variables**: `PUSH_WEBHOOK_URL`, `PUSH_WEBHOOK_SECRET`

---

## 6. Chat & Instant Messaging Providers (17 Adapters)

### 6.1 `whatsapp-business` — Meta WhatsApp Cloud API
- **Protocol**: Meta Graph API v19+
- **Autonomous 24h Session Cost Optimization Engine**: Convey tracks inbound user interactions via dedicated webhook pipelines (`/v1/webhooks/whatsapp/status` vs `/v1/webhooks/whatsapp/incoming`). Dispatches occurring within active 24-hour customer service windows are automatically transformed to **$0.00 zero-cost plain text messages**, bypassing expensive template fees ($0.015+ saved per message).
- **Dedicated Webhook Endpoints**:
  - Status Callback: `POST /v1/webhooks/whatsapp-business/status` or `POST /v1/webhooks/whatsapp/status`
  - Inbound Messages: `POST /v1/webhooks/whatsapp-business/incoming` or `POST /v1/webhooks/whatsapp/incoming`
  - Meta Verification: `GET /v1/webhooks/whatsapp-business` (`hub.mode=subscribe`, `hub.challenge`, `hub.verify_token`)
- **Environment Variables**: `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET`

### 6.2 `twilio-whatsapp` — Twilio WhatsApp
- **Protocol**: Twilio WhatsApp REST API
- **Dedicated Webhook Endpoints**:
  - Status Callback URL: `POST /v1/webhooks/twilio-whatsapp/status`
  - Incoming Message URL: `POST /v1/webhooks/twilio-whatsapp/incoming`
- **Environment Variables**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

### 6.3 `cequens-whatsapp` — Cequens WhatsApp
- **Protocol**: Cequens WhatsApp Business REST API
- **Dedicated Webhook Endpoints**:
  - Status Callback: `POST /v1/webhooks/cequens-whatsapp/status`
  - Inbound Messages: `POST /v1/webhooks/cequens-whatsapp/incoming`
- **Environment Variables**: `CEQUENS_WHATSAPP_KEY`, `CEQUENS_WHATSAPP_SENDER`

### 6.4 `slack` — Slack API (Block Kit)
- **Protocol**: Slack Web API (`chat.postMessage`)
- **Environment Variables**: `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL`, `SLACK_SIGNING_SECRET`

### 6.5 `discord` — Discord Webhooks / Bot
- **Protocol**: Discord REST API v10
- **Environment Variables**: `DISCORD_WEBHOOK_URL`, `DISCORD_BOT_TOKEN`

### 6.6 `telegram` — Telegram Bot API
- **Protocol**: Telegram Bot REST API
- **Environment Variables**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 6.7 `msTeams` — Microsoft Teams (Adaptive Cards)
- **Protocol**: Office 365 Incoming Webhook / Graph API
- **Environment Variables**: `MSTEAMS_WEBHOOK_URL`

### 6.8 `mattermost` — Mattermost
- **Protocol**: Mattermost REST API / Webhooks
- **Environment Variables**: `MATTERMOST_WEBHOOK_URL`, `MATTERMOST_BOT_TOKEN`

### 6.9 `line` — LINE Messaging API
- **Protocol**: LINE Messaging REST API
- **Environment Variables**: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`

### 6.10 `getstream` — Stream Chat
- **Protocol**: GetStream REST API
- **Environment Variables**: `GETSTREAM_API_KEY`, `GETSTREAM_API_SECRET`, `GETSTREAM_APP_ID`

### 6.11 `grafana-on-call` — Grafana OnCall
- **Protocol**: Grafana OnCall Inbound Webhook
- **Environment Variables**: `GRAFANA_ONCALL_WEBHOOK_URL`

### 6.12 `rocket-chat` — Rocket.Chat
- **Protocol**: Rocket.Chat REST API
- **Environment Variables**: `ROCKETCHAT_WEBHOOK_URL`, `ROCKETCHAT_USER_ID`, `ROCKETCHAT_AUTH_TOKEN`

### 6.13 `ryver` — Ryver Chat
- **Protocol**: Ryver Inbound Webhook
- **Environment Variables**: `RYVER_WEBHOOK_URL`

### 6.14 `sendblue` — Sendblue (Apple iMessage & SMS)
- **Protocol**: Sendblue REST API
- **Environment Variables**: `SENDBLUE_API_KEY`, `SENDBLUE_API_SECRET`

### 6.15 `webex-messaging` — Cisco Webex Teams
- **Protocol**: Cisco Webex REST API
- **Environment Variables**: `WEBEX_ACCESS_TOKEN`, `WEBEX_ROOM_ID`

### 6.16 `zulip` — Zulip Streams
- **Protocol**: Zulip REST API
- **Environment Variables**: `ZULIP_BOT_EMAIL`, `ZULIP_API_KEY`, `ZULIP_SITE_URL`

### 6.17 `chat-webhook` — Generic Chat Webhook
- **Protocol**: Custom HTTP POST
- **Environment Variables**: `CHAT_WEBHOOK_URL`, `CHAT_WEBHOOK_SECRET`

---

## 7. Tool & Infrastructure Alerting Providers (4 Adapters)

### 7.1 `pagerduty` — PagerDuty Events API v2
- **Protocol**: PagerDuty Events API v2 (`https://events.pagerduty.com/v2/enqueue`)
- **Lifecycle Support**: `trigger`, `acknowledge`, `resolve`
- **Environment Variables**: `PAGERDUTY_ROUTING_KEY`, `PAGERDUTY_DEFAULT_SEVERITY`

### 7.2 `opsgenie` — Atlassian Opsgenie
- **Protocol**: Opsgenie Alert API v2 (`https://api.opsgenie.com/v2/alerts`)
- **Environment Variables**: `OPSGENIE_API_KEY`, `OPSGENIE_REGION`

### 7.3 `grafana` — Grafana Alertmanager
- **Protocol**: Alertmanager Ingestion API
- **Environment Variables**: `GRAFANA_ALERTMANAGER_URL`, `GRAFANA_ALERTMANAGER_TOKEN`

### 7.4 `tool-webhook` — Generic Tool Webhook
- **Protocol**: Custom HTTP POST
- **Environment Variables**: `TOOL_WEBHOOK_URL`, `TOOL_WEBHOOK_SECRET`

---

## 8. Outbound Transport Proxy Layer (HTTP, HTTPS, SOCKS5)

Convey features an enterprise-grade outbound transport proxy layer that allows any of the **88 provider adapters** to route outbound API and webhook traffic through an intermediate proxy gateway. This enables compliance with zero-trust networks, strict DMZ egress policies, static IP whitelisting requirements, and air-gapped corporate topologies.

### 8.1 Supported Proxy Protocols

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              OUTBOUND TRANSPORT PROXY LAYER                            │
├───────────────────┬──────────────────────────────────┬─────────────────────────────────┤
│   Proxy Protocol  │        Target Connection         │         Underlying Engine       │
├───────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│   HTTP            │ HTTP & HTTPS Targets             │ HTTP CONNECT Tunnel / Forward   │
│   HTTPS           │ HTTP & HTTPS Targets             │ TLS-in-TLS Encapsulated Tunnel  │
│   SOCKS5 / SOCKS5h│ TCP / HTTP / HTTPS Targets       │ RFC 1928 & RFC 1929 Binary Socket│
└───────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

1. **HTTP Proxy (`http://`)**:
   - For plaintext HTTP targets: Executes standard HTTP forward proxy requests.
   - For HTTPS targets: Performs an `HTTP/1.1 CONNECT target:443` socket upgrade and initiates TLS directly with the target server.
   - Supports Basic Authentication (`Proxy-Authorization: Basic <base64>`) and custom headers.

2. **HTTPS Proxy (`https://`)**:
   - Secure TLS connection between Convey and the proxy server itself.
   - For HTTPS targets: Performs **TLS-in-TLS encapsulation** (outer TLS handshake to proxy, HTTP CONNECT tunnel, and inner TLS handshake to target server).
   - Prevents traffic inspection and tampering across untrusted intermediary network hops.

3. **SOCKS5 / SOCKS5h Proxy (`socks5://`, `socks5h://`)**:
   - Zero-dependency binary implementation of **RFC 1928** (SOCKS Protocol Version 5) and **RFC 1929** (Username/Password Authentication).
   - Remote DNS Resolution (`SOCKS5h` / `ATYP 0x03` Domain): Domain names are resolved on the remote proxy server, preventing DNS poisoning and leakage.
   - Supports `NO_AUTH` (`0x00`) and `USER_PASS` (`0x02`) authentication negotiation.
   - Upgrades socket to TLS (`tls.connect`) for HTTPS destinations with full SNI preservation.

### 8.2 Configuration Schema

Proxy settings are configured per-provider under `config.proxy`:

```typescript
export interface ProviderProxyConfig {
  enabled: boolean;
  type: 'http' | 'https' | 'socks5' | 'socks5h';
  host: string;
  port: number;
  auth?: {
    username?: string;
    password?: string;
  };
  noProxy?: string[]; // Bypass list: ['localhost', '*.internal', '10.0.0.0/8']
  timeoutMs?: number; // Socket connect & read timeout (default: 10,000ms)
  tls?: {
    rejectUnauthorized?: boolean;
    ca?: string;
  };
  rawUrl?: string; // Optional full URL: socks5://user:pass@proxy.corp:1080
}
```

### 8.3 Bypass Engine & CIDR Matching

The proxy matcher engine evaluates the `noProxy` bypass list before dispatching any request. Direct zero-overhead socket connections are established when a destination matches:
- **Exact Hostnames**: e.g. `localhost`, `api.internal.local`
- **Wildcard Subdomains**: e.g. `*.internal`, `*.corp.local`
- **Suffix Matching**: e.g. `.corp`, `.local`
- **IPv4 CIDR Blocks**: e.g. `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`

### 8.4 Security & AES-256-GCM Credential Vault

Proxy passwords and credentials stored in PostgreSQL `providers` table are encrypted using **AES-256-GCM** envelope encryption with unique initialization vectors (IV) and authentication tags. When returned through the Admin API or Mission Control Web-UI:
- Passwords and auth tokens are masked with `***` or bullet placeholders (`••••••••`).
- Updates that send `***` preserve the existing encrypted secret without requiring re-entry.

### 8.5 Diagnostic Tools & REST API Endpoints

- **Live Proxy Connection Probe**:
  ```http
  POST /v1/admin/providers/test-proxy
  Content-Type: application/json

  {
    "proxy": {
      "enabled": true,
      "type": "socks5",
      "host": "10.0.1.50",
      "port": 1080,
      "auth": { "username": "corp_user", "password": "SecretPassword123" }
    }
  }
  ```
  Returns:
  ```json
  {
    "success": true,
    "proxyType": "socks5",
    "proxyHost": "10.0.1.50",
    "proxyPort": 1080,
    "handshakeLatencyMs": 4,
    "e2eLatencyMs": 38,
    "dnsResolution": "REMOTE",
    "timestamp": "2026-08-21T19:30:00.000Z"
  }
  ```

- **Provider Connection Test with Proxy Diagnostics**:
  ```http
  POST /v1/admin/providers/test-connection
  Content-Type: application/json

  {
    "providerId": "sendgrid",
    "credentials": { "SENDGRID_API_KEY": "SG.xxx" },
    "config": {
      "proxy": {
        "enabled": true,
        "type": "http",
        "host": "proxy.corp.internal",
        "port": 8080
      }
    }
  }
  ```

### 8.6 Prometheus Observability Metrics

The transport proxy layer exports real-time metrics scraped at `GET /metrics`:

| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `convey_provider_proxy_requests_total` | Counter | `providerId`, `proxyType`, `status` | Total outbound requests dispatched via transport proxies |
| `convey_provider_proxy_duration_seconds` | Histogram | `providerId`, `proxyType` | End-to-end latency distribution for proxied outbound calls |
| `convey_provider_proxy_errors_total` | Counter | `providerId`, `proxyType`, `errorCode` | Total errors encountered during proxy transport execution |

