# Release management

The release workflow runs on `main` updates and manual dispatch from `main`. It prepares a versioned candidate locally, validates that exact revision, then creates and atomically pushes the root tag and nested Go module tag. Publishers depend on successful preparation and validation.

## Candidate sequence

1. Compute the version/changelog using validated inputs to `scripts/release-bump.ts`.
2. Update package versions and lockfile, then make a local candidate commit in the runner.
3. Run `.github/actions/validate/action.yml`: formatting/lint, workspace types, selected units, console and SDK suites, canonical database migrations, strict-auth security tests, SDK integration, legacy server/plugin suites, distribution builds and all application container targets.
4. Require a clean tracked working tree after validation.
5. Push the validated candidate and tags atomically, then create the GitHub release. Downstream jobs publish SDKs and container images from the tag.

A failed check prevents tagging and publishing. The existing legacy regression failures are therefore release blockers, not skipped checks. See [verification](operations/hardening-verification.md).

## Dry runs

Dispatch with `dry_run=true` to prepare and validate a real local candidate without pushing commits, tags, GitHub releases or package/image publications. This still installs dependencies, creates a temporary runner commit, runs tests and builds artifacts. A dry run does not exercise registry credentials or guarantee that later publication will succeed.

Inputs are `bump_type` (`auto`, `patch`, `minor`, `major`, `prerelease`), optional `custom_version`, and `prerelease_tag`. Inputs are passed as arguments through environment variables, not interpolated as shell source. Use dry run before a manual release.

## Toolchain and artifacts

Bun is pinned by `.bun-version` and the Dockerfile. The shared action also pins Go and Python. CI uses isolated PostgreSQL 18 and Redis services; it does not use a developer's database.

Container release targets are `server`, `web` and `plugins`. The TypeScript SDK build checks ESM, CommonJS and both declaration formats. The Go tag uses `packages/sdk-go/vX.Y.Z`; Python distributions are built during validation. Consult the workflow for registry credentials and publication configuration.

Do not infer rollback safety from a successful build. Follow the [migration runbook](operations/hardening-migration.md), record deployed image digests, and validate restore/reconciliation before deploying a schema or security change.
