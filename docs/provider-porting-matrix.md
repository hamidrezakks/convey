# Provider implementation audit

Audited 2026-09-25. The repository contains **88 module entries**, not 88 certified native integrations. Earlier “100% verified” and “all native webhooks cryptographically verified” claims were incorrect.

## Evidence and status

All 88 modules are covered by `apps/server/tests/provider-catalog-contracts.test.ts` for setup rejection, HTTP 401/429/503 handling, and missing/unknown receipt events. `provider-configuration-contracts.test.ts` also checks every console catalog credential example and channel isolation. These checks do **not** certify every vendor request schema or optional feature.

`provider-delivery-contracts.test.ts` exercises local SMTP and HTTP/2 peers, verifies signed push tokens, tests OAuth requests, and checks AWS/Azure SDK invocation. The configuration suite covers native SMS wire requests and text webhook acknowledgements. `provider-receipts.test.ts` checks intermediate statuses, bounce mapping and Mailgun message correlation. No live vendor delivery has been verified.

| Status | Meaning |
|---|---|
| Repaired send path | Concrete send/authentication changes in this audit; offline tests listed above. Live verification and full optional-feature parity remain pending. |
| Present; protocol review pending | Module exists and shared invariants pass. Vendor-specific send, attachment, template, batch and receipt parity are not certified. |
| Unavailable | Native send was an invented generic endpoint. Adapter now rejects before network I/O, even with an override URL. |

## Module-by-module inventory

| Channel | Module | Status |
|---|---|---|
| chat | `cequens-whatsapp` | Present; protocol review pending |
| chat | `chat-webhook` | Present; protocol review pending |
| chat | `discord` | Present; protocol review pending |
| chat | `getstream` | Repaired send path |
| chat | `grafana-on-call` | Present; protocol review pending |
| chat | `line` | Present; protocol review pending |
| chat | `mattermost` | Repaired send path |
| chat | `msTeams` | Present; protocol review pending |
| chat | `rocket-chat` | Present; protocol review pending |
| chat | `ryver` | Present; protocol review pending |
| chat | `sendblue` | Present; protocol review pending |
| chat | `slack` | Repaired send path |
| chat | `telegram` | Present; protocol review pending |
| chat | `twilio-whatsapp` | Present; protocol review pending |
| chat | `webex-messaging` | Present; protocol review pending |
| chat | `whatsapp-business` | Present; protocol review pending |
| chat | `zulip` | Present; protocol review pending |
| email | `anypost` | Present; protocol review pending |
| email | `braze` | Present; protocol review pending |
| email | `brevo` | Present; protocol review pending |
| email | `email-webhook` | Present; protocol review pending |
| email | `emailjs` | Present; protocol review pending |
| email | `infobip` | Present; protocol review pending |
| email | `mailersend` | Present; protocol review pending |
| email | `mailgun` | Present; protocol review pending |
| email | `mailjet` | Present; protocol review pending |
| email | `mailtrap` | Present; protocol review pending |
| email | `mandrill` | Present; protocol review pending |
| email | `netcore` | Present; protocol review pending |
| email | `nodemailer` | Repaired send path |
| email | `outlook365` | Repaired send path |
| email | `plunk` | Present; protocol review pending |
| email | `postmark` | Present; protocol review pending |
| email | `resend` | Present; protocol review pending |
| email | `sendgrid` | Present; protocol review pending |
| email | `ses` | Repaired send path |
| email | `sparkpost` | Present; protocol review pending |
| push | `apns` | Repaired send path |
| push | `appio` | Present; protocol review pending |
| push | `expo` | Present; protocol review pending |
| push | `fcm` | Repaired send path |
| push | `one-signal` | Present; protocol review pending |
| push | `push-webhook` | Present; protocol review pending |
| push | `pusher-beams` | Present; protocol review pending |
| push | `pushpad` | Present; protocol review pending |
| sms | `africas-talking` | Present; protocol review pending |
| sms | `afro-sms` | Unavailable |
| sms | `azure-sms` | Repaired send path |
| sms | `bandwidth` | Present; protocol review pending |
| sms | `brevo-sms` | Repaired send path |
| sms | `bulk-sms` | Present; protocol review pending |
| sms | `burst-sms` | Unavailable |
| sms | `cequens` | Present; protocol review pending |
| sms | `clickatell` | Unavailable |
| sms | `clicksend` | Present; protocol review pending |
| sms | `cm-telecom` | Unavailable |
| sms | `eazy-sms` | Unavailable |
| sms | `firetext` | Repaired send path |
| sms | `forty-six-elks` | Repaired send path |
| sms | `generic-sms` | Present; protocol review pending |
| sms | `gupshup` | Unavailable |
| sms | `imedia` | Unavailable |
| sms | `infobip` | Present; protocol review pending |
| sms | `isend-sms` | Unavailable |
| sms | `isendpro-sms` | Unavailable |
| sms | `kannel` | Unavailable |
| sms | `maqsam` | Unavailable |
| sms | `messagebird` | Repaired send path |
| sms | `mobishastra` | Unavailable |
| sms | `nexmo` | Repaired send path |
| sms | `plivo` | Present; protocol review pending |
| sms | `ring-central` | Unavailable |
| sms | `ruach-sms` | Unavailable |
| sms | `sendchamp` | Unavailable |
| sms | `simpletexting` | Unavailable |
| sms | `sinch` | Repaired send path |
| sms | `sms-central` | Unavailable |
| sms | `sms77` | Repaired send path |
| sms | `smsmode` | Unavailable |
| sms | `sns` | Repaired send path |
| sms | `telnyx` | Repaired send path |
| sms | `termii` | Unavailable |
| sms | `twilio` | Repaired send path |
| sms | `unifonic` | Unavailable |
| tool | `grafana` | Present; protocol review pending |
| tool | `opsgenie` | Present; protocol review pending |
| tool | `pagerduty` | Present; protocol review pending |
| tool | `tool-webhook` | Present; protocol review pending |

## Deployment changes

- Provider success means **accepted**, not delivered. The worker records `dispatched`, emits `delivery.accepted` internally and `message.sent` to subscribers, and increments the sent metric. Delivery status requires a receipt. Consumers relying on the old premature `message.delivered` notification must subscribe to `message.sent` for acceptance.
- No fabricated vendor message IDs. Some webhook/email APIs acknowledge without a message ID; those sends cannot use provider-ID receipt correlation.
- FCM requires a service-account project ID, client email and private key (or the console `FCM_SERVICE_ACCOUNT_JSON` field). Legacy server keys are rejected. FCM/APNs sends support one token per dispatch; multiple tokens fail explicitly rather than dropping recipients. Fan-out with per-token outcomes remains pending.
- APNs requires key, key ID, team ID and bundle ID; uses ES256 and HTTP/2. FCM/APNs/Graph change notifications are not delivery receipts.
- SMTP now actually sends. It requires a host and a complete optional username/password pair. File and URL attachment reads are disabled.
- AWS uses the official SESv2/SNS SDKs, explicit region and credentials, optional session tokens and one SDK attempt; queue workers own retries. SES attachment/template support is not implemented and is no longer advertised by its adapter.
- Outlook uses application credentials and a sender mailbox with Graph `Mail.Send` application permission/admin consent. `202` is acceptance only.
- All HTTP adapters have bounded direct requests; proxy support is tested for Resend and Twilio only. SMTP, APNs and SDK-based transports do not inherit the custom HTTP proxy configuration.
- Console credential aliases normalize at the adapter boundary. Configuration values are not read from ambient environment variables automatically.
- Delivery webhook verification still requires the trusted ingress gateway HMAC described in [security.md](security.md). Native vendor signature verification across the catalog remains unimplemented; do not point arbitrary vendor webhooks directly at this gateway contract.

## Remaining implementation work

The following native SMS implementations are still blocked: `afro-sms`, `burst-sms`, `clickatell`, `cm-telecom`, `eazy-sms`, `gupshup`, `imedia`, `isend-sms`, `isendpro-sms`, `kannel`, `maqsam`, `mobishastra`, `ring-central`, `ruach-sms`, `sendchamp`, `simpletexting`, `sms-central`, `smsmode`, `termii`, `unifonic`. A custom URL cannot repair their missing authentication/payload/response protocols. They are deliberately unavailable, not verified integrations.

For each unavailable integration, obtain its current account/region API contract, implement authentication and exact request/response schemas, add recorded sanitized success/rejection/throttle fixtures, then remove its entry from `INCOMPLETE_NATIVE_PROVIDERS`. `generic-sms` remains available only for an explicitly configured gateway implementing Convey's generic JSON contract.

For every remaining module, finish a vendor-specific contract review, validate advertised attachments/templates/media/batch handling, and verify native webhook event envelopes and signatures. Existing mock success responses are simulation fixtures, not evidence of real delivery. Multi-recipient partial acceptance and per-recipient correlation need a dedicated design before batch support can be certified.

Live certification must use designated test accounts and recipients: verify provider acceptance, actual delivery, a permanent rejection, rate limiting/retry behavior and an authenticated receipt. Record vendor region/API version and test date. No secret values belong in this report or Git history.

## Official protocol references used

- [Microsoft Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0) and [client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Firebase HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- [Apple APNs protocol](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html)
- [Nodemailer SMTP](https://nodemailer.com/smtp), [AWS SES](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples-sending-email.html), [AWS SNS](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/sns-examples-sending-sms.html), [Azure SMS](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/sms/send)
- [Twilio messages](https://www.twilio.com/docs/messaging/api/message-resource), [Telnyx](https://developers.telnyx.com/api-reference/messages/send-a-message), [Brevo SMS](https://developers.brevo.com/docs/transactional-sms-endpoints), [Vonage SMS](https://developer.vonage.com/en/api/sms)
- [MessageBird SMS](https://developers.messagebird.com/api/sms-messaging/), [Sinch batches](https://developers.sinch.com/docs/sms/common-operations/batches), [46elks SMS](https://46elks.com/docs/send-sms), [seven.io SMS](https://docs.seven.io/en/rest-api/endpoints/sms), [FireText](https://www.firetext.co.uk/docs)
- [Stream signing implementation](https://github.com/GetStream/stream-chat-js/blob/master/src/signing.ts), [Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/), [Mattermost incoming webhooks](https://developers.mattermost.com/integrate/webhooks/incoming/)
- [Postmark webhook types](https://postmarkapp.com/developer/webhooks/webhooks-overview), [Mailgun payloads](https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/webhook-payloads), [SendGrid deferrals](https://www.twilio.com/docs/sendgrid/concepts/deliverability/deferrals)
