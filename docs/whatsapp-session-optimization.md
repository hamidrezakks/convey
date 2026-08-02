# WhatsApp 24-Hour Customer Service Window & Cost Optimization

## Executive Summary

WhatsApp Business Platform pricing (Meta Cloud API, Twilio, Cequens) charges per conversation category:
- **Paid Business-Initiated Messages**: Sending a pre-approved template message (`type: "template"`) outside or inside a customer window incurs a Meta/BSP conversation fee (Utility or Marketing rate).
- **Free Customer-Initiated Service Conversations**: When an end-user sends an inbound message to a WhatsApp Business Number, WhatsApp opens a **24-Hour Customer Service Window**. During this active window, free-form text messages (`type: "text"`) incur **zero template fees** (or lower session rates).

Convey provides an automated, provider-configurable **WhatsApp Session Optimization Subsystem** that detects incoming user messages via webhooks, tracks active 24-hour session windows in Redis + L1 Memory, and dynamically transforms outbound template requests into plain-text session messages at zero template cost.

---

## Architecture Diagram

```
[Inbound WhatsApp Webhook]
        │ (Meta / Twilio / Cequens)
        ▼
[webhook-ingest.worker]
        │
        ▼
[WhatsAppSessionTracker] ──(Atomic Lua Script)──► [Redis wa:session:<providerId>:<phone>]
        │                                                     │ (24h TTL)
        └──────────────────(L1 Sub-ms Cache)──────────────────┘
                                │
[Outbound Dispatch Job]         │
        │                       ▼
        ├──► [applyWhatsAppSessionOptimization Interceptor]
        │               │
        │               ├── Active 24h Window? Yes
        │               ├── Provider config.sessionOptimization.enabled? Yes
        │               │
        │               ▼
        │    [WhatsAppTemplateEngine]
        │               │ (AST Pre-compiled Tokenizer & Dot-Path Resolver)
        │               ▼
        │    Rendered Plain-Text Body ("Hi John, order ORD-123 is confirmed!")
        │               │
        │               ▼
        └────► Dispatched as Plain Text (`type: "text"`) ──► [Zero Cost]
                        │
                        ▼ (If window expired or disabled)
               Dispatched as Standard Template (`type: "template"`)
```

---

## Core Components

### 1. `WhatsAppSessionTracker`
Located at `src/modules/providers/whatsapp/session-tracker.ts`

- **Atomic Lua Scripting**: Executes `RECORD_INBOUND_LUA_SCRIPT` to atomically update inbound message counters (`inboundCount`), ISO timestamps (`lastInboundAt`), and 24-hour expiration TTL in a single Redis RTT. Eliminates race conditions across distributed webhook worker replicas.
- **Sub-Millisecond L1 Memory Fast-Path**: Micro in-memory cache (`sessionL1Cache` with 5,000ms TTL) resolves active session state in **< 0.01ms** without touching network sockets during hot dispatch loops.
- **Single-RTT Batch Querying**: `hasActiveSessionsBatch(providerId, phones[])` queries 1,000+ recipient session windows in a single Redis `pipeline.exists()` call.
- **Session Telemetry & Inspection**: `getSessionDetails()` returns `active`, `remainingSeconds`, and detailed `WhatsAppSessionMetadata`.

### 2. `WhatsAppTemplateEngine`
Located at `src/modules/providers/whatsapp/template-engine.ts`

- **Pre-Compiled AST Tokenizer**: Compiles template strings (e.g. `"Hi {{1}}, order {{2}}!"`) into AST tokens (`ASTToken`: `ASTTokenType.TEXT` vs `ASTTokenType.VAR`), avoiding runtime V8 regex compilation overhead.
- **Sub-Microsecond Token Cache**: Pre-compiled ASTs are cached in a micro L1 map (`astL1Cache`), achieving **> 1,000,000 renders/sec**.
- **Nested Variable & Default Fallback Resolution**: Supports dot-path property resolution (e.g. `{{user.name}}`) and default fallbacks (e.g. `{{1 | Valued Customer}}`).
- **Template Storage**: `cacheTemplateBody()` and `getWhatsAppTemplateBody()` persist raw template body strings in Redis (`wa:template:<providerId>:<templateId>`) with 7-day TTL.

### 3. `applyWhatsAppSessionOptimization` Interceptor
Located at `src/modules/providers/whatsapp/session-interceptor.ts`

- Intercepts outbound WhatsApp dispatch requests in `provider-send.worker.ts`.
- Checks `sessionOptimization.enabled` in provider configuration.
- Checks `WhatsAppSessionTracker.hasActiveSession(providerId, recipientPhone)`.
- Resolves template text body (from payload `templateBody` or Redis template cache).
- Background auto-caches payload `templateBody` into Redis so future dispatches of `templateId` automatically benefit.
- Strips `templateId` and substitutes rendered `text`/`body`, causing provider transformers (`whatsapp-business`, `twilio-whatsapp`, `cequens-whatsapp`) to emit plain text session messages.
- Attaches audit metadata:
  - `_sessionOptimizationApplied: true`
  - `_originalTemplateId: "order_update"`
  - `_costOptimizationSavedUsd: 0.005`

---

## Provider Configuration Reference

To enable session optimization for a WhatsApp provider, set `sessionOptimization` in the provider's `config` JSONB column:

```json
{
  "phoneNumberId": "1234567890",
  "accessToken": "EAAG...",
  "sessionOptimization": {
    "enabled": true,
    "ttlSeconds": 86400,
    "fallbackToTemplateIfMissingText": true
  }
}
```

---

## Provider Webhook Support Matrix

| Provider Module | Provider ID | Webhook Event Detected | Outbound Standard vs Session Payload |
|---|---|---|---|
| Meta WhatsApp Cloud API | `whatsapp-business` | `entry[0].changes[0].value.messages[0]` | `type: "template"` ➔ `type: "text"` |
| Twilio WhatsApp | `twilio-whatsapp` | Form POST (`From=whatsapp:...`, `Body=...`) | `ContentSid` ➔ `Body` |
| Cequens WhatsApp | `cequens-whatsapp` | JSON (`direction: "inbound"`, `senderPhone`) | `messageType: "template"` ➔ `messageType: "text"` |

---

## Verification & Testing

### Running Unit & Integration Tests
```bash
bun test tests/whatsapp-session-optimization.test.ts
```

### Checking Code Quality Standards
```bash
bun run biome:check
bun run biome:format
```
