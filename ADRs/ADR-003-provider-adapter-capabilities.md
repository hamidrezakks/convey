# ADR-003: Standalone Provider Adapter Architecture & Circuit Breakers

- **Status**: Accepted
- **Date**: 2026-08-10

## Context
Convey must support 88 external providers across 5 channels (Email, SMS, Push, Chat, Tool) with zero dependency on external monorepo packages.

## Decision
We implement a native, standalone `ProviderAdapter` and `ProviderTransformer` design pattern in `src/modules/providers/`:
- Each provider implements a standardized adapter contract (`send(message, config, credentials)`).
- Node-level `ProviderCircuitBreaker` instances track failure rates and publish state transitions via Redis PubSub (`convey:circuit:events`).
- `SelfHealingEngine` and `GradualRampController` manage automated recovery and stepped traffic ramp-up.

## Consequences
- 100% standalone codebase with zero external monorepo dependencies.
- Isolates provider outages and prevents cascading failures across cluster nodes.
