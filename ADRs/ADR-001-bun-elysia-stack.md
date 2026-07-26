# ADR-001: Adoption of Bun 1.4 and Elysia.js Stack

- **Status**: Accepted
- **Date**: 2026-08-10

## Context
Convey requires a ultra-high-throughput, low-latency REST API runtime capable of processing thousands of message send requests per second with sub-15ms hot-path acceptance latency.

## Decision
We adopt **Bun 1.4** as the primary JavaScript/TypeScript runtime engine and **Elysia.js** as the high-performance HTTP web framework.

## Consequences
- Express/NestJS overhead is eliminated, achieving 4x - 6x higher requests per second.
- Native TypeScript execution without slow transpilation steps.
- Built-in fast SQLite/TLS/HTTP primitives in Bun runtime.
