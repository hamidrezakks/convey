# ADR-004: Standardizing Code Formatting and Linting with Biome

- **Status**: Accepted
- **Date**: 2026-08-10

## Context
Fast, consistent code formatting and static analysis are critical for maintaining codebase quality across high-velocity developer workflows.

## Decision
We standardize on **Biome** (`@biomejs/biome`) as the unified formatter, linter, and code style checker across the repository.

## Consequences
- Replaces ESLint and Prettier with a single ultra-fast Rust-based binary.
- Sub-100ms linting and formatting execution time (`bun run biome:check`).
