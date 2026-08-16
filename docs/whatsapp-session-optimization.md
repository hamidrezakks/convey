# WhatsApp 24-Hour Customer Service Window & Cost Optimization Subsystem

## 1. Executive Summary & Financial ROI

Under Meta's **WhatsApp Business Platform pricing model**, business-initiated template messages (`type: "template"`) incur fixed per-conversation fees ranging from **$0.005 to $0.075+ per conversation** depending on the recipient country and category (Utility, Authentication, or Marketing).

However, when an end-user sends an inbound message to a WhatsApp Business Number, WhatsApp opens a **24-Hour Customer Service Window**. During this active 24-hour window, free-form text messages (`type: "text"`) incur **$0.00 Meta template fees** (free tier service conversations).

Convey features an autonomous **WhatsApp Session Optimization Engine** (`src/modules/providers/whatsapp/`) that automatically detects inbound customer messages, tracks active 24-hour conversation windows in Redis and L1 process memory, and dynamically transforms outbound template messages into rendered plain-text session messages at **zero template cost**.

### Financial Impact Model (1,000,000 Messages / Month)
| Strategy | Template Cost / Msg | Monthly Expenditure | Annual Expenditure | Annual Savings |
| :--- | :--- | :--- | :--- | :--- |
| **Traditional Gateway (Standard Templates)** | $0.015 | $15,000 | $180,000 | Baseline |
| **Convey Autonomous Session Optimizer (60% Inbound Active)** | $0.000 (Session) / $0.015 (Template) | $6,000 | $72,000 | **$108,000 / year (60% Savings)** |

---

## 2. Architecture & Dataflow Diagram

```text
[Inbound WhatsApp Webhook] (Meta Cloud API / Twilio / Cequens)
        │
        ▼
[webhook-ingest.worker.ts]
        │
        ▼
[WhatsAppSessionTracker] ──(Atomic Redis Lua Script)──► [Redis wa:session:<providerId>:<phone>]
        │                                                           │ (24h Expiration TTL)
        └──────────────────(L1 Sub-Millisecond Cache)───────────────┘
                                        │
[Outbound Dispatch Job]                 │
        │                               ▼
        └──► [applyWhatsAppSessionOptimization Interceptor]
                        │
                        ├── Is 24h Window Active? ──► [WhatsAppTemplateEngine]
                        │                                    │ (Pre-compiled AST Tokenizer & Dot-Path)
                        │                                    ▼
                        │                      Rendered Plain-Text Body ("Order #10928 confirmed!")
                        │                                    │
                        │                                    ▼
                        │                      Dispatched as Plain Text (`type: "text"`) ──► [$0.00 Cost]
                        │                      Audit Metadata Attached (_sessionOptimizationApplied)
                        │
                        └── Is Window Expired / Inactive?
                                        │
                                        ▼
                               Dispatched as Standard Template (`type: "template"`) ──► [Paid Fee]
```

---

## 3. Subsystem Core Components

### 3.1 `WhatsAppSessionTracker` (`src/modules/providers/whatsapp/session-tracker.ts`)
- **Atomic Redis Lua Scripting**: Executes `RECORD_INBOUND_LUA_SCRIPT` in a single Redis network round-trip. Updates inbound message counters (`inboundCount`), timestamps (`lastInboundAt`), and resets the 24-hour TTL atomically, eliminating race conditions across distributed webhook worker replicas.
- **Sub-Millisecond L1 Memory Fast-Path**: An in-memory LRU cache (`sessionL1Cache` with 5,000ms TTL) resolves active session state in **`< 0.01ms`** without touching Redis during hot dispatch loops.
- **Single-RTT Batch Querying**: `hasActiveSessionsBatch(providerId, phones[])` queries 1,000+ recipient numbers in a single pipelined Redis `EXISTS` call.
- **Session Telemetry & Inspection**: `getSessionDetails()` returns `active`, `remainingSeconds`, `inboundCount`, and `lastInboundAt`.

### 3.2 `WhatsAppTemplateEngine` (`src/modules/providers/whatsapp/template-engine.ts`)
- **Pre-Compiled AST Tokenizer**: Compiles template strings (e.g. `"Hi {{1}}, your order {{2}} is confirmed!"`) into AST token arrays (`ASTToken`: `TEXT` vs `VAR`), avoiding expensive V8 regex compilations at runtime.
- **Sub-Microsecond AST Token Cache**: Pre-compiled ASTs are memoized in `astL1Cache`, achieving **> 1,250,000 renders/sec**.
- **Dot-Path Variable & Fallback Resolution**: Supports dot-path property traversal (e.g. `{{user.profile.name}}`) and default fallback values (e.g. `{{1 | Valued Customer}}`).
- **Template Storage & Synchronization**: `cacheTemplateBody()` and `getWhatsAppTemplateBody()` persist raw template strings in Redis (`wa:template:<providerId>:<templateId>`) with a 7-day TTL.

### 3.3 `applyWhatsAppSessionOptimization` Interceptor (`src/modules/providers/whatsapp/session-interceptor.ts`)
- Intercepts outbound WhatsApp messages inside `provider-send.worker.ts`.
- Verifies provider `config.sessionOptimization.enabled`.
- Queries `WhatsAppSessionTracker.hasActiveSession(providerId, recipientPhone)`.
- If active:
  - Resolves template text body (from request `templateBody` or Redis template cache).
  - Renders dynamic variables into plain text via `WhatsAppTemplateEngine`.
  - Replaces `template` payload with plain text `body`, causing provider transformers (`whatsapp-business`, `twilio-whatsapp`, `cequens-whatsapp`) to emit native plain-text payloads.
  - Injects audit telemetry:
    ```json
    {
      "_sessionOptimizationApplied": true,
      "_originalTemplateId": "order_confirmed",
      "_costOptimizationSavedUsd": 0.015
    }
    ```

---

## 4. Provider Configuration Reference

To enable session optimization for a WhatsApp provider, include `sessionOptimization` in the provider configuration:

```json
{
  "phoneNumberId": "109283719283",
  "accessToken": "EAAG...",
  "sessionOptimization": {
    "enabled": true,
    "ttlSeconds": 86400,
    "fallbackToTemplateIfMissingText": true
  }
}
```

---

## 5. Provider Webhook Support Matrix

| Provider Module | Provider ID | Webhook Inbound Trigger | Payload Transformation |
| :--- | :--- | :--- | :--- |
| **Meta WhatsApp Cloud API** | `whatsapp-business` | `entry[0].changes[0].value.messages[0]` | `type: "template"` ➔ `type: "text"` |
| **Twilio WhatsApp** | `twilio-whatsapp` | Form POST (`From=whatsapp:+...`, `Body=...`) | `ContentSid` ➔ `Body` |
| **Cequens WhatsApp** | `cequens-whatsapp` | JSON (`direction: "inbound"`, `senderPhone`) | `messageType: "template"` ➔ `messageType: "text"` |

---

## 6. Automated Testing & SLA Verification

The WhatsApp Session Optimization subsystem is verified by comprehensive unit and performance test suites:
- **Unit & Interceptor Tests**: `tests/whatsapp-session-optimization.test.ts`
- **AST Render Engine SLA Benchmark**: Verified at **> 1,000,000 renders/sec** in `tests/e2e/load-10k-benchmark.test.ts`.
