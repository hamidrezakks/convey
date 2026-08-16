# ADR-004: Standardizing Code Formatting and Linting with Biome

- **Status**: Accepted
- **Date**: 2026-08-10
- **Authors**: Convey Principal Architecture Team
- **Deciders**: Developer Experience, Systems Engineering

---

## 1. Context & Problem Statement
High-velocity engineering across a large codebase with 88 provider modules, 74 test suites, and 640+ files requires fast, deterministic, and strict static analysis and code formatting.

Traditional toolchains combining **ESLint**, **Prettier**, and multiple plugins introduce:
- Slow CI execution times (> 45 - 90 seconds for full linting passes).
- Configuration complexity and plugin version mismatch errors.
- Discrepancies between linting rules and code formatting formatting.

---

## 2. Decision Drivers
- **Execution Speed**: Sub-second linting and formatting across 600+ TypeScript files.
- **Unified Tooling**: Single configuration file (`biome.json`) replacing separate ESLint and Prettier configs.
- **Strict Correctness**: Enforcing modern TypeScript best practices (no unused templates, strict type safety, no redundant any).

---

## 3. Considered Alternatives
1. **ESLint + Prettier**: Standard industry combination. Rejected due to high startup latency and slow execution speed on large codebases.
2. **Oxlint**: Ultra-fast linter. Rejected due to lacking an integrated formatter.
3. **Biome (`@biomejs/biome`)**: Single Rust-based unified binary providing ultra-fast linting, formatting, and import sorting. **Selected**.

---

## 4. Decision Outcome
We standardize on **Biome** across the Convey repository:
- All CI workflows and local pre-commit checks run `bun run biome:check` and `bun run biome:format`.
- Single root configuration file `biome.json` configures strict rules, indent styles, and import sorting.

---

## 5. Consequences

### Positive Consequences
- **Blazing Performance**: Lints and formats 645 files in **`< 50ms`** (100x faster than ESLint).
- **Zero Config Sprawl**: Replaces 10+ ESLint plugins with one clean `biome.json`.
- **Instant Developer Feedback**: Real-time formatting in IDEs with zero noticeable lag.

### Negative Consequences / Mitigations
- **Plugin Ecosystem Differences**: Specific obscure ESLint plugins may not have exact 1:1 Biome equivalents (mitigated by comprehensive TypeScript compiler checks).
