# Convey Developer & Agent Guidelines

## Repository Scope
This repository (`convey/`) contains the complete source code, tests, documentation, and configuration for the **Convey** communication service.

`convey/` is **100% standalone**. There are no runtime imports or file dependencies on `novu/`.

## Commands
- **Install Dependencies**: `bun install`
- **Development Server**: `bun run dev`
- **Run Tests**: `bun test`
- **Biome Check**: `bun run biome:check`
- **Biome Format**: `bun run biome:format`
- **Generate Migrations**: `bun run db:generate`
- **Run Migrations**: `bun run db:migrate`

## Architectural Rules
1. **Zero Provider Message ID Exposure**: Public APIs expose opaque ULID IDs (`msg_<ULID>`) and hide internal provider message IDs.
2. **Idempotency Guarantee**: Scoped by team boundary; same key + same payload returns original `202 Accepted` response.
3. **Database Performance**: Keep synchronous send acceptance to 1 DragonflyDB `SET NX` + 1 PostgreSQL 18 transaction (`INSERT messages` + `INSERT outbox`).
4. **BullMQ-First**: Near-term execution (`<= 30 minutes`) uses BullMQ (on DragonflyDB); long-term scheduling (`> 30 minutes`) uses PostgreSQL 18.

## Pre-release Schema and Compatibility Policy

Convey has not had its first release. Until the owner explicitly releases version one:
- Keep the latest complete schema in the canonical CREATE migrations. Edit the original table definition; do not add ALTER TABLE patches, schema backfills, or upgrade-only migrations.
- A changed baseline requires an explicitly recreated development/test database and fresh queue state. Never automatically drop user data.
- Do not preserve obsolete Convey payloads, plaintext credential formats, configuration aliases, or old schema behavior for backward compatibility. Update producers, consumers, fixtures and documentation together.
- Keep encryption-key rotation, vendor protocol support and operational retries; these are not old Convey-version compatibility.
- At the first release, freeze the baseline and establish versioned forward migrations and an explicit compatibility/deprecation policy. Do not add speculative compatibility paths before that point.
- Publishing is an explicit release-owner action, not a side effect of merging to main.
