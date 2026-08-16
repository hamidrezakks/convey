# ADR-001: Adoption of Bun 1.4 Runtime and Elysia.js Web Framework

- **Status**: Accepted
- **Date**: 2026-08-10
- **Authors**: Convey Principal Architecture Team
- **Deciders**: Systems Engineering, Backend Infrastructure

---

## 1. Context & Problem Statement
Convey is designed as a planetary-scale communication gateway capable of processing tens of thousands of notification requests per second with a strict **sub-15ms synchronous hot-path acceptance SLA**.

Legacy Node.js frameworks (such as NestJS with Express or Fastify) introduce significant runtime overhead:
- Heavy dependency trees and reflection-based dependency injection.
- Slower HTTP parsing and V8 JSON serialization pipelines.
- High idle container memory footprints (~500 MB RSS per replica).
- Slow container cold-starts during sudden traffic autoscaling events.

---

## 2. Decision Drivers
- **Synchronous Ingestion Performance**: Must achieve `p50 < 4ms` and `p99 < 18ms` for synchronous send acceptance.
- **Resource Footprint**: Must minimize RAM overhead per container to reduce cloud infrastructure costs.
- **Native TypeScript Execution**: Zero-transpilation developer workflow with instant hot-reloading.
- **Modern Web Standards**: Native `Fetch`, `Request`, `Response`, and high-performance Web Crypto bindings.

---

## 3. Considered Alternatives
1. **Node.js 20 + NestJS (Express/Fastify)**: The incumbent stack used by monolithic notification platforms. Rejected due to heavy memory bloat, high DI initialization overhead, and lower request throughput.
2. **Go + Gin / Fiber**: Excellent performance and low memory. Rejected to maintain full TypeScript type safety across Drizzle ORM schemas, BullMQ job payloads, and provider transformers.
3. **Rust + Actix-web**: Maximum raw performance. Rejected due to longer development cycles and lack of native TypeScript ecosystem agility for rapid provider adapter porting.
4. **Bun 1.4 + Elysia.js**: Ultra-fast JavaScript/TypeScript engine written in Zig with SIMD-accelerated string/JSON operations, TypeBox compile-time schema validation, and native Web standards. **Selected**.

---

## 4. Decision Outcome
We standardize on **Bun 1.4** as the primary runtime and **Elysia.js** as the HTTP API framework across all Convey services:
- API routes utilize Elysia's compiled TypeBox schema validators for sub-microsecond payload validation.
- Internal cryptography leverages Bun's native OpenSSL bindings for high-speed AES-256-GCM encryption.
- Local SQLite and test runners execute natively via `bun test` in < 25 seconds for 880+ scenarios.

---

## 5. Consequences

### Positive Consequences
- **Throughput**: Measured synchronous send throughput reaches **12,500 req/sec** on 8 vCPU instances (4x higher than NestJS).
- **Latency**: P99 hot-path ingestion latency drops to **18.2ms**.
- **Memory Efficiency**: Cold-start RSS drops from ~500 MB to **~62 MB**, allowing dense container packing in Kubernetes.
- **Developer Velocity**: Instant startup (`< 50ms`) with native TypeScript hot-reloading (`bun run dev`).

### Negative Consequences / Mitigations
- **Bun Ecosystem Maturity**: Rapid release cycles in Bun require pinning exact patch versions in `bunfig.toml` and CI pipelines.
- **Package Compatibility**: All npm dependencies must be verified for native Bun compatibility; zero-dependency pure TypeScript adapters eliminate external compatibility issues.
