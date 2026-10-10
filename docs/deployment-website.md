# Website deployment

This runbook covers the Next.js documentation website at `https://convey.barnamekon.com`. It is a separate deployment from the Convey API, gateway, workers, and databases. Its deployment target is the existing production VM at `204.168.246.189`, under `/opt/convey-website`.

Initial live website verification is pending. During setup, the proxied DNS record, Full (strict) mode, and Let's Encrypt origin certificate were verified. Record the container and hosted-page checks below after deployment.

## Deployment files and runtime

- [`apps/website/Dockerfile`](../apps/website/Dockerfile): builds the website from the repository root and produces a Next.js standalone image.
- [`docker-compose.website.yml`](../docker-compose.website.yml): starts only the website service.
- [`deploy/website/traefik.yaml`](../deploy/website/traefik.yaml): routes `convey.barnamekon.com` through the existing Traefik file provider.
- [`.github/workflows/website.yml`](../.github/workflows/website.yml): checks pull requests, builds deployment artifacts, and deploys main.

The container listens on port `3000`, with no host port published. It joins the existing external `traefik-public` Docker network with the alias `convey-website`. Traefik reaches the service at `http://convey-website:3000`.

The runtime uses UID `1000`, a read-only root filesystem, and writable temporary filesystems at `/tmp` and `/app/apps/website/.next/cache`. It serves the standalone Next.js output and copied static assets; API services and their credentials are not part of this container.

Website builds use `next build --webpack` with the repository's explicit `@` and `.source` aliases and produce standalone output. The Docker dependency stage installs with `--linker=hoisted`, so packaging the standalone tree does not leave references to isolated `.bun` dependencies. The `builder` stage uses Bun 1.4 on Alpine; the runtime uses Node.js 22 on Alpine, keeping native dependencies on the same libc family. The container's port `3000` differs from the website development server's port `5174`.

Build the repository image from the repository root:

```bash
docker build -f apps/website/Dockerfile -t convey-website:local .
```

On a host with the external network and Traefik already configured, the repository compose file can build and start the website:

```bash
docker compose -p convey-website -f docker-compose.website.yml up -d --build --wait
```

## One-time VM setup

Use the existing administrator connection to `root@204.168.246.189` for setup. The dedicated CI credential is for artifact deployment and cannot replace trusted infrastructure files.

The VM needs Docker with the Compose plugin, Python 3, `curl`, `flock`, and GNU core utilities, in addition to the existing Traefik installation.

Create `/opt/convey-website/releases` and install the trusted runtime files in:

```text
/opt/convey-website/runtime/Dockerfile.runtime
/opt/convey-website/runtime/compose.yaml
/opt/convey-website/runtime/extract-website.py
/usr/local/sbin/convey-deploy-website
```

Keep these files administrator-owned. The runtime Dockerfile packages an already-built website. The compose file controls the network, mounts, privileges, health check, and service. The extraction script validates the incoming artifact archive. The deployment helper accepts a commit SHA and selects the corresponding release directory.

Install the matching repository sources:

| Repository source | VM destination |
| :--- | :--- |
| [`deploy/website/Dockerfile.runtime`](../deploy/website/Dockerfile.runtime) | `/opt/convey-website/runtime/Dockerfile.runtime` |
| [`deploy/website/compose.yaml`](../deploy/website/compose.yaml) | `/opt/convey-website/runtime/compose.yaml` |
| [`scripts/extract-website.py`](../scripts/extract-website.py) | `/opt/convey-website/runtime/extract-website.py` |
| [`scripts/deploy-website`](../scripts/deploy-website) | `/usr/local/sbin/convey-deploy-website` (executable) |

Install the dedicated deployment public key with the authorized-key options `command="/usr/local/sbin/convey-deploy-website",restrict`. The helper accepts only the exact original command `deploy <40-lowercase-hex-SHA>`; CI streams a gzip tar archive on standard input. This key cannot start an interactive session or forward connections.

Copy `deploy/website/traefik.yaml` to `/opt/traefik/dynamic/convey.yaml`, using the existing file provider. Its router uses host `convey.barnamekon.com`, entrypoint `websecure`, and certificate resolver `letsencrypt`. Confirm that the existing Traefik container and website share `traefik-public`.

Changes to the helper, extractor, runtime Dockerfile, compose policy, or Traefik configuration require this administrator installation procedure. They are not applied by streaming a new website artifact.

## DNS and TLS

Configure the `barnamekon.com` DNS zone with a proxied `A` record named `convey`, pointing at `204.168.246.189`. Set the proxy's SSL/TLS mode to **Full (strict)** so it validates Traefik's origin certificate.

The existing Traefik installation supplies the HTTPS listener and `letsencrypt` resolver. Check both the proxy-facing hostname and the origin route after DNS and certificates are ready. The website compose deployment does not install a second proxy or publish another host port.

## GitHub Actions configuration

Create these repository Actions secrets:

| Secret | Value to supply |
| :--- | :--- |
| `WEBSITE_DEPLOY_KEY` | Private key for the dedicated forced-command deployment credential |
| `WEBSITE_DEPLOY_KNOWN_HOSTS` | Pinned SSH host key entry for the deployment host, verified through a trusted administrator connection |

Optional repository variables:

| Variable | Default |
| :--- | :--- |
| `WEBSITE_DEPLOY_HOST` | `204.168.246.189` |
| `WEBSITE_DEPLOY_USER` | `root` |

Do not put private keys, SSH credential values, or application secrets in the repository. Host key pinning must remain enabled.

The workflow runs build/test checks for pull requests when website, shared-package, or deployment/build files change. Matching pushes to `main` deploy the website. Manual `workflow_dispatch` runs default to `main`, and deployment remains restricted to main; use a main commit for an approved manual redeployment.

The Ubuntu runner builds through the Docker `artifact` stage, which exports only the standalone tree after the `builder` stage copies `.next/static` into it. It packages that output with both symlinks and hard links dereferenced. CI validates/extracts the archive with `scripts/extract-website.py` and smoke-tests a production container built from the extracted output before uploading the artifact.

The deploy job streams that same gzip tar archive over SSH with `deploy <SHA>`. This transfers built application files, rather than executing a checkout's deployment scripts on the VM.

The VM's trusted helper validates and extracts the stream into `/opt/convey-website/releases/<SHA>/standalone` and saves its compressed archive digest as `archive.sha256`. The artifact root must contain `apps/website/server.js` and `apps/website/.next/BUILD_ID`; only directories and regular files are accepted. Input and extracted content are bounded, and archive links are rejected.

The helper builds `convey-website:<SHA>` with the installed runtime Dockerfile, using the release as its build context. It starts that image through the trusted runtime compose file with `--no-build --wait --wait-timeout 120`. It then checks origin HTTPS `/healthz`, resolving the hostname to `127.0.0.1` on the VM with certificate verification enabled. Only after both checks pass does it atomically update `/opt/convey-website/current` to the relative target `releases/<SHA>`.

Uploads to an existing SHA must match the saved compressed artifact digest. A new build of the same commit may produce different bytes and be rejected; reuse the original workflow artifact for the same-SHA redeployment. Existing image tags are reused rather than overwritten. The workflow retains its artifact for seven days; keep the VM's previous successful release/image available for rollback.

If activation fails, the helper attempts to restore the preceding image without advancing the current pointer. A failed first deployment attempts to remove its service. Any reported rollback failure requires administrator investigation.

## Health and production smoke checks

`GET /healthz` returns `{ "status": "ok", "service": "convey-website" }`. It is independent of the Convey API's `/health` and `/health/readiness` probes.

After a deploy, check the container state and the public routes:

```bash
curl --fail --show-error https://convey.barnamekon.com/healthz
curl --fail --show-error --output /dev/null https://convey.barnamekon.com/
curl --fail --show-error --output /dev/null https://convey.barnamekon.com/docs
curl --fail --show-error --output /dev/null https://convey.barnamekon.com/docs/gateway
curl --fail --show-error 'https://convey.barnamekon.com/api/search?query=gateway'
```

Inspect the home page, documentation navigation, gateway page, and search results in a browser as well. Verify that CSS and static assets load, search returns useful results, HTTPS validates, and the served content corresponds to the intended commit.

Record the deployed SHA, workflow run, health result, route checks, and any remaining limitation. Treat a failed public smoke check as a deployment problem even if the container is healthy.

## Rollback

Keep the preceding successful directory under `/opt/convey-website/releases/<SHA>` and its `convey-website:<SHA>` image. Rollback uses that artifact with the trusted runtime files; it does not rebuild a historical checkout or change Traefik/DNS.

Use one administrator shell on the VM and hold the helper's deployment lock to prevent a simultaneous CI activation:

```bash
exec 9>/opt/convey-website/.deploy.lock
flock -x 9
```

Set `previous_sha` to the prior successful 40-character SHA. If its image was removed, rebuild it from the retained artifact first:

```bash
docker build -f /opt/convey-website/runtime/Dockerfile.runtime \
  -t "convey-website:$previous_sha" \
  "/opt/convey-website/releases/$previous_sha"
```

Start the previous image with the trusted compose file and the same project name:

```bash
WEBSITE_IMAGE_TAG="$previous_sha" docker compose \
  --project-name convey-website \
  --project-directory /opt/convey-website/runtime \
  -f /opt/convey-website/runtime/compose.yaml \
  up -d --no-build --wait --wait-timeout 120

curl --fail --show-error \
  --resolve convey.barnamekon.com:443:127.0.0.1 \
  https://convey.barnamekon.com/healthz
```

After both checks pass, update the release pointer atomically:

```bash
rollback_pointer="/opt/convey-website/.current-rollback-$$"
ln -s "releases/$previous_sha" "$rollback_pointer"
mv -Tf "$rollback_pointer" /opt/convey-website/current
flock -u 9
```

Repeat the public smoke checks. The helper's automatic rollback already preserves the previous pointer; this manual pointer update is for an administrator-initiated rollback.

If the previous artifact is missing, redeploy a known-good main commit through the workflow. Infrastructure policy changes need a separate administrator rollback of the installed trusted files.

## Troubleshooting

- Container health failure: inspect website logs, standalone output layout, static/public assets, and permissions on the two writable temporary filesystems.
- Traefik `502`: confirm the external network, `convey-website` alias, container port `3000`, and dynamic service target.
- Certificate failure: inspect the existing `letsencrypt` resolver, origin certificate, hostname rule, DNS record, and Full (strict) setting.
- SSH rejection: check the pinned host key, forced key entry, and `deploy <SHA>` command. Infrastructure installation requires the administrator connection.
- Archive rejection: check the artifact layout and tar dereferencing step. Correct the build/archive; do not bypass the trusted extractor.
- Healthy container with broken docs/search: run the public smoke checks, inspect application logs, and verify that the expected commit's MDX/search output was included.
