# Convey Release Management & SemVer Deployment Guide

This document outlines the **Semantic Versioning 2.0.0**, **Docker Container Release**, and **NPM Package Publishing** architecture configured for the **Convey** planetary communication service monorepo.

---

## 1. Release Architecture Overview

The release pipeline coordinates three artifacts:
1. **GitHub Releases & Git Tags**: Annotated SemVer tags (`vX.Y.Z`) with structured changelogs.
2. **NPM Package (`@convey/sdk`)**: Production client library compiled for ESM and CommonJS with TypeScript declarations and SLSA provenance.
3. **Docker Multi-Arch Images (`GHCR`)**:
   - `ghcr.io/<owner>/convey-server`: Elysia API service, BullMQ queue workers, and PostgreSQL partition relays.
   - `ghcr.io/<owner>/convey-web`: Vite & React Admin Mission Control console.

```
                  ┌─────────────────────────────────────┐
                  │ Conventional Commits (feat, fix...) │
                  └──────────────────┬──────────────────┘
                                     │
                     git push origin main OR workflow_dispatch
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ .github/workflows/release.yml       │
                  │ - Compute SemVer (major/minor/patch)│
                  │ - Update monorepo package.json files│
                  │ - Prepend CHANGELOG.md              │
                  │ - Create Git Tag vX.Y.Z & GH Release│
                  └─────────┬─────────────────┬─────────┘
                            │                 │
              ┌─────────────┴──────┐   ┌──────┴────────────────────┐
              ▼                    │   ▼                           ▼
┌───────────────────────────────┐  │ ┌────────────────────────────────────────┐
│ NPM Release (@convey/sdk)     │  │ │ Docker Multi-Arch Build (GHCR)         │
│ - bun build (ESM & CJS)       │  │ │ - platforms: linux/amd64, linux/arm64  │
│ - tsc declaration emit        │  │ │ - convey-server (target: server)       │
│ - npm publish --provenance    │  │ │ - convey-web (target: web)             │
│ - tags: latest or beta        │  │ │ - tags: 1.2.3, 1.2, 1, latest, sha-*   │
└───────────────────────────────┘  │ └────────────────────────────────────────┘
```

---

## 2. Semantic Versioning & Conventional Commits

Convey follows strict **Conventional Commits**:

| Commit Type | SemVer Impact | Description | Example |
|---|---|---|---|
| `feat:` | **MINOR** (`1.0.0` ➔ `1.1.0`) | Introducing a new feature or public capability | `feat(sdk): add auto-pagination iterator` |
| `fix:` | **PATCH** (`1.0.0` ➔ `1.0.1`) | Bug fix or operational correction | `fix(server): resolve race condition in outbox relay` |
| `perf:` | **PATCH** (`1.0.0` ➔ `1.0.1`) | Performance optimization | `perf(router): optimize SIMD shard hashing` |
| `BREAKING CHANGE:` or `feat!:` | **MAJOR** (`1.0.0` ➔ `2.0.0`) | Breaking API or schema changes | `feat(api)!: rename endpoint /v1/send to /v1/messages` |
| `docs:`, `chore:`, `ci:`, `test:`, `refactor:` | **PATCH** (if unreleased changes exist) | Maintenance, documentation, and internal refactors | `docs(readme): update deployment topology` |

---

## 3. Workflow Trigger Modes

### A. Automated Release (Continuous Delivery)
When commits are merged into `main`, GitHub Actions:
1. Compares commit history against the latest Git tag (`vX.Y.Z`).
2. Calculates the required SemVer bump.
3. Automatically updates `package.json` across workspaces and prepends `CHANGELOG.md`.
4. Commits `chore(release): bump version to vX.Y.Z [skip ci]` and pushes tag `vX.Y.Z`.
5. Publishes `@convey/sdk` to NPM and pushes multi-arch images to GHCR.

### B. Manual Dispatch (`workflow_dispatch`)
Release engineers can trigger releases on-demand via the GitHub Actions web interface:
- **`bump_type`**: `auto` (default), `patch`, `minor`, `major`, `prerelease`.
- **`custom_version`**: Explicit version override (e.g. `1.2.0-rc.1`).
- **`prerelease_tag`**: Identifier for prereleases (default: `beta`).
- **`dry_run`**: Set to `true` to test changelog generation and SemVer evaluation without pushing changes.

---

## 4. Docker Multi-Arch Container Images

Docker images are pushed to GitHub Container Registry (`ghcr.io`):

### Tagging Scheme
When release `v1.2.3` is created:
- `ghcr.io/<owner>/convey-server:1.2.3` (Full SemVer)
- `ghcr.io/<owner>/convey-server:1.2` (Minor SemVer alias)
- `ghcr.io/<owner>/convey-server:1` (Major SemVer alias)
- `ghcr.io/<owner>/convey-server:latest` (Stable track)
- `ghcr.io/<owner>/convey-server:sha-<commit_sha>` (Immutable commit reference)

### Pulling and Running
```bash
# Pull server backend
docker pull ghcr.io/<owner>/convey-server:latest

# Run with environment configuration
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://postgres:postgres@host.docker.internal:5432/convey" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  ghcr.io/<owner>/convey-server:latest

# Pull web console UI
docker pull ghcr.io/<owner>/convey-web:latest
docker run -d -p 5173:5173 ghcr.io/<owner>/convey-web:latest
```

---

## 5. NPM Package Publishing (`@convey/sdk`)

The SDK is published with zero external runtime dependencies and signed with **SLSA Provenance**:
- **Bundle**: Dual ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`).
- **Types**: Full TypeScript definitions (`dist/index.d.ts` and `dist/index.d.cts`) with sourcemaps.
- **Security**: Built with `--provenance` via GitHub Actions OIDC.

### Installation
```bash
bun add @convey/sdk
# or
npm install @convey/sdk
```

---

## 6. Required GitHub Secrets & Permissions

1. **`NPM_TOKEN`**: Granular Access Token with publish permissions for the `@convey` npm organization or scope.
2. **`GITHUB_TOKEN`**: Automatically provided by GitHub Actions. Ensure **"Read and write permissions"** is enabled in `Settings -> Actions -> General -> Workflow permissions`.
