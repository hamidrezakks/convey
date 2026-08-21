#!/bin/sh
set -e

# Convey Container Lifecycle Entrypoint
echo "⚡ Starting Convey Container Initialization..."

# Check if auto-migration is enabled (defaults to true)
if [ "${AUTO_MIGRATE:-true}" = "true" ] || [ "${AUTO_MIGRATE:-true}" = "1" ]; then
  echo "📦 AUTO_MIGRATE enabled: Running canonical database migrations and monthly partitions..."
  bun apps/server/src/db/migrate.ts
  echo "✅ Database migrations and partitions verified."
fi

# Execute passed command or default to starting the Convey server
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec bun apps/server/src/index.ts
fi
