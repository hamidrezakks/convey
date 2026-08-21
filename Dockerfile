# ==============================================================================
# ⚡ CONVEY MULTI-STAGE DOCKERFILE
# Multi-tenant, planetary-scale communication infrastructure service
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Base Image
# ------------------------------------------------------------------------------
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ------------------------------------------------------------------------------
# 2. Monorepo Dependencies Installation
# ------------------------------------------------------------------------------
FROM base AS dependencies
WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY scripts ./scripts

RUN bun install --frozen-lockfile

# ------------------------------------------------------------------------------
# 3. Production Server Runner (@convey/server)
# ------------------------------------------------------------------------------
FROM base AS server
WORKDIR /app

# Copy cached dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=dependencies /app/apps/server/node_modules ./apps/server/node_modules

# Copy workspace sources
COPY package.json bun.lock bunfig.toml tsconfig.json biome.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV AUTO_MIGRATE=true

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health/liveness').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "apps/server/src/index.ts"]

# ------------------------------------------------------------------------------
# 4. Web Console Builder (@convey/web)
# ------------------------------------------------------------------------------
FROM dependencies AS web-builder
WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN bun run --filter @convey/web build

# ------------------------------------------------------------------------------
# 5. Production Web Console Runner (@convey/web)
# ------------------------------------------------------------------------------
FROM base AS web
WORKDIR /app

COPY --from=web-builder /app/apps/web/dist ./apps/web/dist
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=dependencies /app/node_modules ./node_modules
COPY apps/web/package.json apps/web/vite.config.ts ./apps/web/
COPY package.json ./

ENV PORT=5173
EXPOSE 5173

CMD ["bun", "run", "--filter", "@convey/web", "preview", "--host", "0.0.0.0", "--port", "5173"]
