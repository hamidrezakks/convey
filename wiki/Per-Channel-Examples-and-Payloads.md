# Per-channel request payloads

Convey accepts `POST /v1/messages` with a `channels` array and a `recipients` object. `idempotencyKey`, `userId`, `team`, `category` and two-letter `country` are required. The credential must authorize the supplied team. Use the [current API reference](../docs/api.md) for response shapes and endpoint details.

```sh
curl http://localhost:3000/v1/messages \
  -H "Authorization: Bearer $CONVEY_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "idempotencyKey": "welcome-482-v1",
    "userId": "customer-482",
    "team": "orders",
    "category": "transactional",
    "country": "US",
    "recipients": {"email": "customer@example.test"},
    "channels": [{
      "channel": "email",
      "content": {"subject": "Welcome", "text": "Your account is ready."}
    }]
  }'
```

Replace `orders` with the credential's team. A configured provider is required for delivery. The example address is synthetic. HTTP 202 means accepted for processing, not delivered; save `messageId` and query its status.

## Channel names and recipients

| Channel value | Recipient field | Example content |
| --- | --- | --- |
| `email` | `email` | `subject`, `text` and/or `html` |
| `sms` | `phone` | `text` |
| `whatsapp` | `whatsapp` | Provider-specific template or message content |
| `telegram` | `telegramChatId` | `text` |
| `slack` | `slack.channelId` | `text` |
| `fcm` | `fcmTokens` | `title`, `body` |
| `apns` | `apnsTokens` | `title`, `body` |

Push and chat are channel families, not request enum values. Provider-specific payload support and receipt capabilities must be checked in the [provider inventory](../docs/operations/provider-capability-matrix.md). A catalog entry does not guarantee live-provider qualification.

## Multiple channels, fallback and cascade

Multiple entries in `channels` dispatch independently. Their order does not mean “try the next channel only after failure.” Use the configured fallback/cascade contract for conditional delivery and verify its receipt behavior. The [gateway usage guide](../apps/gateway/USAGE.md) includes current multi-channel, cascade, failure-fallback and bulk examples, including the known callback fallback-shape limitation.

## Send without an address

The optional [recipient gateway](../apps/gateway/README.md) resolves missing fields from `userId` using a scoped customer adapter. Direct Convey calls still supply recipients. The gateway preserves explicit overrides, fills a missing team from verified credentials, and resolves fallback/cascade addresses before forwarding. SDKs that require a recipients object can use `{}` when targeting the gateway.

## SDK examples and payload security

Runnable language examples live in [examples](../examples/README.md); source-matched SDK guidance lives in the [TypeScript](../packages/sdk/README.md), [Go](../packages/sdk-go/README.md) and [Python](../packages/sdk-py/README.md) package directories. Use an explicit base URL for your own deployment.

See [payload key management](../docs/operations/payload-key-management.md) for encrypted storage. API payload examples are not a claim that every routing field, queue record, log or backup is encrypted.
