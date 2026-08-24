import type { DocSection } from './quickstart';

export const providersDoc: DocSection = {
  id: 'providers',
  title: 'Provider Ecosystem & Turnkey Adapters',
  description:
    'Setup guides for 88+ turnkey provider integrations across Email, SMS, WhatsApp, Push, Chat, and Webhooks with dynamic fallback and smart scorecard routing.',
  headings: [
    { id: 'ecosystem-overview', title: 'Provider Ecosystem Overview', level: 2 },
    { id: 'email-adapters', title: 'Email Channel Adapters (20 Providers)', level: 2 },
    { id: 'sms-adapters', title: 'SMS Channel Adapters (39 Providers)', level: 2 },
    { id: 'whatsapp-adapters', title: 'WhatsApp Business Adapters', level: 2 },
    { id: 'push-adapters', title: 'Push Notification Adapters (FCM & APNs)', level: 2 },
    { id: 'chat-adapters', title: 'Chat & Collaboration (Slack, Discord, Teams)', level: 2 },
    { id: 'smart-routing', title: 'Smart Router & Fallback Strategies', level: 2 },
    { id: 'mock-sandbox', title: 'Zero-Cost Sandbox Testing', level: 2 },
  ],
  content: `
## Provider Ecosystem Overview

Convey includes **88 turnkey provider adapters** natively compiled with Bun 1.4:

| Channel | Count | Notable Supported Adapters |
| :--- | :--- | :--- |
| 📧 **Email** | **20** | AWS SES, SendGrid, Resend, Postmark, Mailgun, Brevo, SparkPost, MailerSend, SMTP |
| 📱 **SMS** | **39** | Twilio, Vonage (Nexmo), Plivo, MessageBird, Infobip, Telnyx, Sinch, AWS SNS, Clickatell |
| 💬 **WhatsApp** | **6** | Meta Cloud API (Graph API v20), Twilio WhatsApp, Infobip, 360dialog, Gupshup |
| 🔔 **Push** | **8** | Firebase Cloud Messaging (FCM HTTP v1), Apple APNs (HTTP/2), OneSignal, Expo, Pusher |
| 🗣️ **Chat** | **17** | Slack (Block Kit), Discord Webhooks, Telegram Bot API, Microsoft Teams Adaptive Cards |
| 🛠️ **Tool / Inbound** | **4** | Custom Webhook, PagerDuty, Opsgenie, Zendesk |

---

## Email Channel Adapters (20 Providers)

### AWS Simple Email Service (SES v2)
AWS SES delivers ultra-low cost ($0.10 / 1,000 emails) with high deliverability.

\`\`\`json
{
  "providerId": "aws-ses",
  "credentials": {
    "region": "us-east-1",
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "fromEmail": "notifications@convey.internal"
  }
}
\`\`\`

### Resend / SendGrid
\`\`\`json
{
  "providerId": "resend",
  "credentials": {
    "apiKey": "re_123456789_abcdefg",
    "fromEmail": "updates@convey.internal"
  }
}
\`\`\`

---

## SMS Channel Adapters (39 Providers)

### Twilio SMS
\`\`\`json
{
  "providerId": "twilio",
  "credentials": {
    "accountSid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "authToken": "your_auth_token_here",
    "fromNumber": "+18005550199"
  }
}
\`\`\`

### Vonage (Nexmo) SMS
\`\`\`json
{
  "providerId": "vonage",
  "credentials": {
    "apiKey": "f8a92b1c",
    "apiSecret": "secret_xyz789",
    "from": "CONVEY"
  }
}
\`\`\`

---

## WhatsApp Business Adapters

### Meta Cloud API (Official Direct Graph API)
\`\`\`json
{
  "providerId": "meta-whatsapp",
  "credentials": {
    "phoneNumberId": "10492817291029",
    "wabaId": "9182736451029",
    "accessToken": "EAAX...system_user_token"
  }
}
\`\`\`

---

## Push Notification Adapters (FCM & APNs)

### Firebase Cloud Messaging (FCM HTTP v1)
\`\`\`json
{
  "providerId": "fcm",
  "credentials": {
    "projectId": "convey-production-fcm",
    "clientEmail": "firebase-adminsdk@convey-production-fcm.iam.gserviceaccount.com",
    "privateKey": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
  }
}
\`\`\`

---

## Chat & Collaboration (Slack, Discord, Teams)

### Slack (Block Kit Support)
\`\`\`json
{
  "providerId": "slack",
  "credentials": {
    "botToken": "xoxb-98217391823-9182739182-abcdefg"
  }
}
\`\`\`

---

## Smart Router & Fallback Strategies

Convey supports 4 routing strategies:
1. **\`SMART_SCORECARD\`**: Uses Thompson Sampling Multi-Armed Bandit (MAB) with Exponential Moving Average (EMA) scoring to route traffic to the fastest, most reliable provider.
2. **\`PRIMARY_FALLBACK\`**: Attempts the primary provider and cascades down an ordered fallback array on failure.
3. **\`LEAST_COST\`**: Routes each message through the provider with the lowest unit cost per recipient country/region.
4. **\`ROUND_ROBIN\`**: Distributes load evenly across all healthy provider instances.

---

## Zero-Cost Sandbox Testing

For staging environments and CI/CD pipelines, Convey provides an isolated **Mock Sandbox Engine**:
- Use \`x-sandbox: true\` header or prefix API keys with \`cv_sandbox_...\`.
- Dispatches are processed end-to-end (validation, AES encryption, outbox commit, BullMQ DRR queues) but wire calls are captured in the sandbox inspection ledger without incurring upstream vendor fees.
`,
};
