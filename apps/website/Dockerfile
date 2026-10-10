# Build from the repository root: docker build -f apps/website/Dockerfile .
FROM oven/bun:1.4.0-alpine AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/server/package.json ./apps/server/
COPY apps/plugins/package.json ./apps/plugins/
COPY apps/web/package.json ./apps/web/
COPY apps/website/package.json ./apps/website/
COPY apps/mock-server/package.json ./apps/mock-server/
COPY scripts/patch-openapi.ts ./scripts/patch-openapi.ts
RUN bun install --frozen-lockfile --linker=hoisted

FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY apps/website ./apps/website
RUN bun --filter @convey/website generate \
    && bunx tsc --noEmit -p apps/website/tsconfig.json \
    && bun run build:website \
    && cp -r apps/website/.next/static apps/website/.next/standalone/apps/website/.next/static

# Export only the deployable tree, without exporting the build dependency image.
FROM scratch AS artifact
COPY --from=builder /app/apps/website/.next/standalone /

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/apps/website/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/website/server.js"]
