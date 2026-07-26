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
3. **Database Performance**: Keep synchronous send acceptance to 1 Redis `SET NX` + 1 Postgres transaction (`INSERT messages` + `INSERT outbox`).
4. **BullMQ-First**: Near-term execution (`<= 30 minutes`) uses BullMQ; long-term scheduling (`> 30 minutes`) uses PostgreSQL.
