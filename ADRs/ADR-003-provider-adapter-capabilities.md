# ADR-003: Standalone Provider Adapter Architecture & Resilience Engine

- **Status**: Accepted
- **Date**: 2026-08-10
- **Authors**: Convey Principal Architecture Team
- **Deciders**: Systems Engineering, Integration Architecture

---

## 1. Context & Problem Statement
Convey must support **88 turnkey communication providers** across 5 channels (Email, SMS, Push, Chat, Tool).

Traditional monolithic notification architectures bundle vendor SDKs and provider adapters into complex, deeply nested monorepo packages (`@novu/framework`, `@novu/stateless`, `@novu/shared`). This introduces heavy dependency sprawl, slow installation times, brittle runtime version conflicts, and vulnerability to cascading vendor outages.

---

## 2. Decision Drivers
- **100% Standalone Boundary**: Zero external monorepo dependencies or shared package imports.
- **Uniform Interface**: Normalized adapter contract across all 88 providers for seamless polymorphic routing.
- **Cascading Outage Prevention**: Circuit breaker protection and dynamic hedged execution to prevent provider latency spikes from blocking the platform.
- **Zero Provider ID Leakage**: Public APIs must never expose upstream vendor IDs.

---

## 3. Considered Alternatives
1. **Importing Monorepo Packages (`@novu/stateless`)**: Use existing upstream provider wrappers. Rejected due to heavy dependency graphs, outdated SDK versions, and breaking standalone boundary rules.
2. **Generic Dynamic Webhook Dispatch**: Only support generic HTTP POST webhooks, requiring external systems to transform payloads. Rejected because out-of-the-box turnkey provider support is a core functional requirement.
3. **Native Standalone Adapter & Transformer Architecture**: Build pure TypeScript modules with standardized `ProviderAdapter`, `ProviderTransformer`, `ProviderMock`, and node-level `ProviderCircuitBreaker`. **Selected**.

---

## 4. Decision Outcome
We implement the **Standalone Provider Adapter & Resilience Subsystem**:
1. **Module Structure**: Every provider lives under `src/modules/providers/<channel>/<provider-id>/` implementing:
   - `<provider-id>.adapter.ts`: Core `send(message, config, credentials)` implementation.
   - `<provider-id>.transformer.ts`: Pure schema transformer from Convey format to vendor format.
   - `<provider-id>.mock.ts`: Fast in-memory mock handler for test suites.
2. **Resilience Stack**:
   - `ProviderCircuitBreaker`: Failure rate tracking with Redis PubSub cluster sync.
   - `GradualRampController`: Stepped traffic admission (5% ➔ 20% ➔ 50% ➔ 100%) during half-open recovery.
   - `HedgedExecutor`: Speculative concurrent backup dispatch when primary provider latency reaches p95.
   - `SelfHealingEngine`: Background synthetic canary probes to safely verify degraded vendors.

---

## 5. Consequences

### Positive Consequences
- **Zero Runtime Dependencies**: The entire provider ecosystem is self-contained in pure TypeScript.
- **Outage Containment**: A degraded provider automatically trips its local circuit breaker, diverting traffic to backup providers without affecting other channels.
- **Fast Test Execution**: Mock harnesses allow running 880+ test scenarios in < 25 seconds without external network requests.

### Negative Consequences / Mitigations
- **Maintenance Surface**: Maintaining 88 native provider adapters requires strict transformer unit test coverage and automated contract verification suites (`tests/provider-transformers.test.ts`).
