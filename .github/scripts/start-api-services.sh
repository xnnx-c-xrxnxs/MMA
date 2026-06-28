#!/usr/bin/env bash
# start-api-services.sh
#
# Reads .github/service-registry.json and starts each API service as a
# background process. Service port env vars must already be in the environment
# (loaded from .github/service-registry.env via $GITHUB_ENV).
#
# To add a new domain: add an entry to .github/service-registry.json.
# No changes to this script are needed.

set -e

REGISTRY=".github/service-registry.json"

if [ ! -f "$REGISTRY" ]; then
  echo "Error: $REGISTRY not found" >&2
  exit 1
fi

mkdir -p logs

echo "Starting all API services from registry..."

while IFS= read -r line; do
  NAME=$(echo "$line" | cut -d'|' -f1)
  DIST_PATH=$(echo "$line" | cut -d'|' -f2)
  if [ ! -f "$DIST_PATH" ]; then
    echo "Error: built artifact not found: $DIST_PATH" >&2
    exit 1
  fi
  LOG_FILE="logs/${NAME}.log"
  echo "Starting $DIST_PATH (logs: $LOG_FILE) ..."
  node "$DIST_PATH" > "$LOG_FILE" 2>&1 &
done < <(node -e "
  const r = require('./.github/service-registry.json');
  r.apiServices.forEach(s => console.log(s.name + '|' + s.distPath));
")

echo "All API services started in background."
