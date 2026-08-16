# Convey Fallback & Failover State Machine Specification

Convey implements a dual-layer resilience architecture to guarantee message delivery even during severe upstream cloud provider outages: **Layer 1: Same-Channel Provider Failover** and **Layer 2: Cross-Channel Cascade Fallback**.

---

## 1. Execution Flow & Decision Engine

```text
                               ┌────────────────────────────────────────────────────────┐
                               │               PRIMARY PROVIDER EXECUTION               │
                               │  (e.g., WhatsApp via whatsapp-business adapter)       │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                                               ┌───────────────────────┐
                                               │ Was Attempt Successful│
                                               └───────────┬───────────┘
                                                           │
                                        ┌──────────────────┴──────────────────┐
                                        │ (Yes)                               │ (No)
                                        ▼                                     ▼
                        ┌───────────────────────────────┐     ┌───────────────────────────────┐
                        │ State ➔ 'delivered'           │     │ Classify Provider Error Code  │
                        │ Update Telemetry & Finish     │     │ (Transient vs Terminal Error) │
                        └───────────────────────────────┘     └───────────────┬───────────────┘
                                                                              │
                                                      ┌───────────────────────┴───────────────────────┐
                                                      │ (Transient: 429 / 503 / Timeout)              │ (Terminal: Invalid Number / 400)
                                                      ▼                                               ▼
                                      ┌───────────────────────────────┐               ┌───────────────────────────────┐
                                      │ Check Provider CircuitBreaker │               │ Skip Retries / Same-Channel   │
                                      │ Evaluate Same-Channel Backup  │               │ Jump Direct to Cross-Channel  │
                                      └───────────────┬───────────────┘               └───────────────┬───────────────┘
                                                      │                                               │
                                      ┌───────────────┴───────────────┐                               │
                                      │                               │                               │
                                 (Available)                     (Exhausted)                          │
                                      │                               │                               │
                                      ▼                               ▼                               │
                      ┌───────────────────────────────┐ ┌───────────────────────────────────────────┐ │
                      │ LAYER 1: SAME-CHANNEL FAILOVER│ │ LAYER 2: CROSS-CHANNEL WATERFALL CASCADE  │◄┘
                      │ e.g. twilio-whatsapp          │ │ Evaluate request fallback.rules           │
                      │ Origin: 'provider_failover'   │ │ (e.g. WhatsApp ➔ Push ➔ SMS ➔ Email)      │
                      └───────────────────────────────┘ └─────────────────────┬─────────────────────┘
                                                                              │
                                                      ┌───────────────────────┴───────────────────────┐
                                                      │                                               │
                                                 (Rule Matches)                                 (No Match / All Exhausted)
                                                      │                                               │
                                                      ▼                                               ▼
                                      ┌───────────────────────────────┐               ┌───────────────────────────────┐
                                      │ Enqueue Fallback Channel Job  │               │ Message State ➔ 'failed'      │
                                      │ Origin: 'fallback'            │               │ Route to Dead-Letter Queue    │
                                      │ Apply Quiet-Hours & Templates │               │ (POST /v1/dlq/replay)         │
                                      └───────────────────────────────┘               └───────────────────────────────┘
```

---

## 2. Error Categorization & Retry Taxonomy

When a provider returns an error or times out, Convey classifies the error into one of three categories to prevent wasteful retries on terminal errors:

| Category | HTTP Codes / Vendor Signals | Behavior & Strategy | Retry Action |
| :--- | :--- | :--- | :--- |
| **`TRANSIENT`** | `429 Too Many Requests`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`, Socket Hangup, Connection Reset. | Upstream provider is temporarily degraded or throttled. Circuit breaker failure counter increments. | Retry with **Full-Jitter Exponential Backoff** ($2^n \times \text{random}()$) up to `maxRetries` (default: 3). If failed, trigger Same-Channel Failover. |
| **`TERMINAL_PROVIDER`**| `401 Unauthorized`, `403 Forbidden`, `Invalid API Credentials`, `IP Not Whitelisted`. | Local provider credential error or account suspension. Circuit breaker trips immediately. | Immediately bypass further retries on this provider; fail over to alternative enabled provider in the same channel. |
| **`TERMINAL_RECIPIENT`**| `400 Bad Request (Malformed Phone/Email)`, `404 Recipient Not Found`, `Unsubscribed / Suppressed`, `Invalid Device Token`. | Recipient identifier is invalid for this channel. Retrying with another provider on the same channel will also fail. | Immediately bypass all same-channel retries; trigger **Cross-Channel Waterfall Cascade** (e.g. try SMS if Push token is invalid). |

---

## 3. Fallback Rules Specification & Syntax

Fallback behavior is defined via the `fallback` object in `POST /v1/messages` or set via tenant default policy:

### Schema Example: Multi-Stage Waterfall Cascade
```json
{
  "fallback": {
    "enabled": true,
    "strategy": "waterfall",
    "rules": [
      {
        "when": { "channel": "push", "event": "failed" },
        "send": [
          {
            "channel": "chat",
            "provider": "whatsapp-business",
            "timeoutMs": 15000
          }
        ]
      },
      {
        "when": { "channel": "chat", "event": "failed" },
        "send": [
          {
            "channel": "sms",
            "provider": "twilio",
            "timeoutMs": 10000
          }
        ]
      },
      {
        "when": { "channel": "sms", "event": "failed" },
        "send": [
          {
            "channel": "email",
            "provider": "ses"
          }
        ]
      }
    ]
  }
}
```

### Rule Evaluation Pipeline (`CascadeManager`)
1. **Event Matcher**: Upon provider failure, `CascadeManager.evaluateFallback()` matches the failed `channel` and `event` (e.g. `failed`, `timeout`, `undelivered`).
2. **Channel Content Resolution**: Pulls the channel content payload from the encrypted envelope (`_encryptedEnvelope`). If channel content for the target fallback channel was not provided in the original request, Convey checks for pre-configured templates.
3. **Recipient Address Validation**: Confirms that recipient contact information exists for the target fallback channel (e.g., verifying `recipients.phone` exists before falling back to SMS).
4. **Queue Enqueuing**: Dispatches a new job to `dispatchQueue` with:
   - `attemptOrigin: "fallback"`
   - `parentMessageId: "msg_<ULID>"`
   - `channel: targetChannel`
   - `fallbackDepth: previousDepth + 1` (capped at max depth 4).

---

## 4. Circuit Breaker & Gradual Ramp Interaction

Every provider adapter is protected by a dedicated node-level `ProviderCircuitBreaker`:

```text
    ┌────────────────┐
    │     CLOSED     │ ──(Failure Rate > 50% over 10s Window)──► ┌────────────────┐
    │(Normal Traffic)│                                           │      OPEN      │
    └────────────────┘ ◄──(Gradual Ramp Reaches 100% Success)── │(All Failover)  │
           ▲                                                     └───────┬────────┘
           │                                                             │
           │                                             (After 30s Cooldown / Canary Pass)
           │                                                             │
           │                     ┌───────────────────┐                   ▼
           └──────────────────── │     HALF_OPEN     │ ◄─────────────────┘
                                 │(Stepped 5%➔20%➔50%)
                                 └───────────────────┘
```

- **`CLOSED`**: All traffic routes through primary provider.
- **`OPEN`**: 100% of traffic is immediately diverted to backup providers or fallback channels without making external HTTP requests.
- **`HALF_OPEN` (`GradualRampController`)**: Admits probe traffic in calibrated stepped increments (5% ➔ 20% ➔ 50% ➔ 100%). If probe errors occur, the breaker immediately returns to `OPEN`.
- **Cluster Synchronization**: State changes broadcast across all active Convey nodes via Redis PubSub (`convey:circuit:events`).

---

## 5. Dead-Letter Queue (DLQ) & Operator Recovery

When all same-channel retries, provider failovers, and cross-channel fallback rules are exhausted:

1. **State Transition**: Message transitions to `state = 'failed'` and is flagged as DLQ-eligible.
2. **PostgreSQL Ledger Recording**: An entry is recorded in `message_attempts` detailing the final `lastError` with full stack and vendor error code.
3. **Audit Event**: Emits `message.dlq_routed` event in `message_events`.
4. **Operator Replay**:
   - Query failed messages: `GET /v1/dlq?team=payments&limit=50`
   - Replay messages with provider override:
     ```bash
     curl -X POST http://localhost:3000/v1/dlq/replay \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <api_key>" \
       -d '{
         "messageIds": ["msg_01J0N7C0W7X2R6S8V9Q9B1E4G3"],
         "overrideProvider": "resend"
       }'
     ```
