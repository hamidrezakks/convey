# Using the Convey gateway

Applications call the gateway instead of Convey's API origin. They supply a `userId` and message content. The gateway fills missing recipient addresses through the customer adapter, then sends the request to Convey. Convey still owns routing, delivery status, retries and budgets.

## Try it with mock customers

From the repository root:

```sh
bun run mock:gateway
```

Copy the printed URL and use the fake token `demo-key`. Available users are `alice` (all supported delivery fields), `bob` (email and phone), and `email-only`. These requests produce mock acceptance, not real notifications.

For an already running gateway, use its actual URL and your existing **tenant DEVELOPER or ORG_ADMIN** API key. Keep the key in your backend. You do not need to pass a team; the gateway fills it from the verified credential. If supplied, the team must match that credential.

```sh
export GATEWAY_URL=http://127.0.0.1:REPLACE_WITH_PRINTED_PORT
export CONVEY_API_KEY=demo-key
```

## Send an email by user ID

```sh
curl "$GATEWAY_URL/v1/messages" \
  -H "Authorization: Bearer $CONVEY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"alice",
    "idempotencyKey":"order-482-email-v1",
    "category":"transactional",
    "country":"US",
    "channels":[{
      "channel":"email",
      "content":{"subject":"Order confirmed","text":"Your order is confirmed."}
    }]
  }'
```

The gateway resolves `recipients.email`. HTTP 202 means accepted, not delivered. Save the returned `messageId`, then read status through the same gateway:

```sh
curl "$GATEWAY_URL/v1/messages/$MESSAGE_ID" \
  -H "Authorization: Bearer $CONVEY_API_KEY"
```

With a real Convey upstream, `GET /v1/messages/$MESSAGE_ID/timeline` and `/trace` expose the usual permitted history. The mock simulator implements basic status only.

## Reusable backend examples

Run this JavaScript with Bun or Node. The examples below reuse `send` and `base`. Execute each example separately to avoid unintentionally triggering every example in a real deployment.

```js
const origin = process.env.GATEWAY_URL;
const apiKey = process.env.CONVEY_API_KEY;
if (!origin || !apiKey) throw new Error('GATEWAY_URL and CONVEY_API_KEY are required');

async function send(path, payload) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error('Convey request failed'), {
    status: response.status, result,
  });
  return result;
}

const email = {
  channel: 'email',
  content: {subject: 'Order confirmed', text: 'Your order is confirmed.'},
};
const sms = {channel: 'sms', content: {text: 'Your order is confirmed.'}};
const base = {
  userId: 'alice', category: 'transactional', country: 'US',
  channels: [email],
};
```

### Email and SMS together

```js
const accepted = await send('/v1/messages', {
  ...base,
  idempotencyKey: 'order-482-both-v1',
  channels: [email, sms],
});
console.log(accepted.messageId);
```

The gateway resolves both email and phone. Convey dispatches both channels independently. The array order does not mean “email first, then SMS only on failure.” Each dispatch can consume budget.

### Email first, SMS if delivery remains unconfirmed

```js
await send('/v1/messages', {
  ...base,
  idempotencyKey: 'order-482-cascade-v1',
  cascade: {
    enabled: true,
    steps: [
      {...email, condition: 'always', waitForReceiptMs: 60000},
      {...sms, condition: 'if_undelivered'},
    ],
  },
});
```

The gateway resolves both addresses before acceptance, even though the initial channel is email. An enabled cascade drives Convey's dispatch. The SMS step becomes eligible after the wait if Convey has not recorded delivery. Late or missing receipts can still result in both channels delivering. The mock simulator verifies address enrichment only; it does not execute the cascade or wait 60 seconds.

### SMS on a provider send failure

```js
await send('/v1/messages', {
  ...base,
  idempotencyKey: 'order-482-failure-v1',
  fallback: {rules: [{
    when: {channel: 'email', event: 'failed'},
    send: [sms],
  }]},
});
```

This rule targets Convey's provider-worker failure path. The current Convey callback worker reads a different fallback shape, so do not rely on this rule for a later failed/bounced delivery callback. The gateway does not repair or reinterpret that upstream behavior. Use the cascade example for delivery remaining unconfirmed, and verify the required upstream behavior before live use.

### A bulk notification request

```js
const result = await send('/v1/messages/bulk', {
  messages: ['alice', 'bob'].map(userId => ({
    ...base,
    userId,
    idempotencyKey: `campaign-2026-10:${userId}`,
    campaignId: 'campaign-2026-10',
  })),
});
console.log(result.items);
```

The gateway accepts up to 500 messages and deduplicates customer lookups for repeated user IDs within the request. If any required customer/address cannot be resolved, it forwards none of that submission. Convey's own bulk response and per-item outcomes still need to be inspected. With the default bulk customer adapter, concurrent submissions in the same tenant/team/sandbox share a lookup: flush at 100 waiting requests, 100 unique users, or 300 ms after the first request. Larger submissions are split into lookup chunks of at most 100 users. Convey still receives each original submission separately. Single/bulk **customer lookup mode** is independent of single/bulk **message submission**.

### Override one address

```js
await send('/v1/messages', {
  ...base,
  idempotencyKey: 'order-482-override-v1',
  channels: [email, sms],
  recipients: {email: 'override@example.test'},
});
```

The gateway preserves that email and resolves only the missing phone. When all required recipient fields are supplied, it skips customer lookup. Explicit overrides are allowed; the gateway is not a policy restricting recipients to a user's own addresses.

## Recipient fields

| Channel | Customer recipient field |
| --- | --- |
| `email` | `email` |
| `sms` | `phone` |
| `whatsapp` | `whatsapp` |
| `telegram` | `telegramChatId` |
| `slack` | `slack.channelId` |
| `fcm` | `fcmTokens` array |
| `apns` | `apnsTokens` array |

The gateway does not infer WhatsApp from a phone number. Fields required by fallback and cascade steps must also exist. Optional profile attributes are not copied into message metadata.

## Errors and retries

| Result | What to do |
| --- | --- |
| 400 | Fix malformed JSON, invalid channels or oversized bulk count. |
| 401 / 403 | Check the credential, role and matching team. Lookup must not proceed with rejected credentials. |
| 413 / 415 | Keep requests below 4 MiB and send uncompressed `application/json`. |
| 422 `RECIPIENT_NOT_FOUND` / `RECIPIENT_MISSING` | Correct the user ID or customer address before resubmitting. |
| 503 `CUSTOMER_BUSY` | The bounded lookup queue is full or closing. Honor `Retry-After: 1` and retry with the same idempotency key. |
| 502 `CUSTOMER_UNAVAILABLE` | Investigate the customer adapter, response shape, scope and connectivity. |
| 502 `UPSTREAM_UNAVAILABLE` | Investigate Convey connectivity/auth-session availability. A send timeout can leave acceptance uncertain. |
| Upstream 409 | Inspect the original request and idempotency conflict. |
| Upstream 429 | Honor `Retry-After` and apply bounded retries. |

Reuse the exact original payload and idempotency key for a transport retry. The gateway does not automatically retry sends. Because it resolves contacts afresh, a profile change can cause a conflict even if your original user-ID-only payload is unchanged. Inspect the saved message or investigate the unresolved attempt rather than changing the key to force another send. If your application supplies explicit recipients, persist that request for exact replay.

## Connect an existing service

For the default HTTP adapter, set `CONVEY_URL` and `CUSTOMER_URL`. Supply `CUSTOMER_TOKEN` if your customer endpoint requires authentication. Choose `CUSTOMER_LOOKUP_MODE=single` or `bulk` (default) and optionally set `CUSTOMER_LOOKUP_PATH`.

A low-traffic lookup may wait up to 300 ms to collect neighbours, plus worker queue and network time within the overall request deadline. Set `CUSTOMER_BATCH_WAIT=0s` to remove intentional collection delay, or a shorter value such as `25ms` for latency-sensitive traffic. See [batching and performance](PERFORMANCE.md).

**The real customer endpoint is not defined yet.** Match the reference contract in [README.md](README.md#customer-adapter-contract), or implement `customer.Resolver`. The gateway cannot automatically adapt arbitrary response shapes. Single mode defaults to `GET /v1/customers/{userId}?team=...`; bulk mode defaults to `POST /v1/customers/resolve`.

From the repository root, build and run on the existing service network (replace `YOUR_NETWORK`, `server`, and `customer`):

```sh
docker build -t convey-gateway apps/gateway
docker run --rm --name convey-gateway \
  --network YOUR_NETWORK \
  --read-only --cap-drop=ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 \
  -e CONVEY_URL=http://server:3000 \
  -e CUSTOMER_URL=http://customer:4000 \
  -e CUSTOMER_TOKEN \
  -e CUSTOMER_LOOKUP_MODE=bulk \
  convey-gateway
```

The image runs as UID 10001. Terminate TLS at your existing ingress. `/healthz` and `/readyz` report the gateway listener, not both dependencies. Send SIGTERM to drain it. No database migration or new Redis instance is required.

Existing Convey clients can use the gateway base URL. If an SDK requires a `recipients` object, use `{}` for resolution or use the HTTP examples above. This change does not add new gateway-specific SDK builders. Administrative APIs remain available only through Convey's administration endpoint; the gateway blocks them. See [README.md](README.md#proxy-surface) for the complete forwarding scope and [SIMULATOR.md](SIMULATOR.md) for test commands.
