# Convey Provider Porting Matrix

This document tracks the complete porting status of provider adapters and transformers from Novu specs into Convey's high-performance native provider module structure (`src/modules/providers/`).

---

## 1. Porting Overview

- **Target**: 100% provider capability parity across 5 channel types.
- **Standalone Guarantee**: All provider adapters and transformers in Convey use pure Bun/TypeScript implementation with zero dependency on `@novu/shared` or `@novu/framework`.
- **Status**: **100% COMPLETE (88 of 88 Providers Ported & Verified)**.

---

## 2. Parity Status by Channel

### Email Channel (20 / 20 Ported - 100%)
- `ses`, `sendgrid`, `resend`, `mailgun`, `postmark`, `brevo`, `mailjet`, `sparkpost`, `mandrill`, `mailersend`, `nodemailer`, `plunk`, `mailtrap`, `anypost`, `braze`, `emailjs`, `infobip`, `netcore`, `outlook365`, `email-webhook`.

### SMS Channel (39 / 39 Ported - 100%)
- `twilio`, `nexmo`, `plivo`, `sinch`, `telnyx`, `termii`, `bandwidth`, `cequens`, `infobip`, `messagebird`, `gupshup`, `clicksend`, `clickatell`, `sns`, `africas-talking`, `afro-sms`, `azure-sms`, `brevo-sms`, `bulk-sms`, `burst-sms`, `cm-telecom`, `eazy-sms`, `firetext`, `forty-six-elks`, `generic-sms`, `imedia`, `isend-sms`, `isendpro-sms`, `kannel`, `maqsam`, `mobishastra`, `ring-central`, `ruach-sms`, `sendchamp`, `simpletexting`, `sms-central`, `sms77`, `smsmode`, `unifonic`.

### Push Channel (8 / 8 Ported - 100%)
- `fcm`, `apns`, `one-signal`, `expo`, `pusher-beams`, `pushpad`, `appio`, `push-webhook`.

### Chat Channel (17 / 17 Ported - 100%)
- `whatsapp-business`, `twilio-whatsapp`, `cequens-whatsapp`, `slack`, `discord`, `telegram`, `msTeams`, `mattermost`, `line`, `getstream`, `grafana-on-call`, `rocket-chat`, `ryver`, `sendblue`, `webex-messaging`, `zulip`, `chat-webhook`.

### Tool Channel (4 / 4 Ported - 100%)
- `pagerduty`, `opsgenie`, `grafana`, `tool-webhook`.

---

## 3. Verification & Compliance

All 88 provider integrations are continuously tested via unit tests (`tests/provider-transformers.test.ts`) and end-to-end load benchmark suites (`tests/e2e/all-tables-e2e.test.ts`).
