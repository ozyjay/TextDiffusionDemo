#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-3300}"
BACKEND_PORT="${BACKEND_PORT:-8300}"

for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Open Day mode does not choose random fallback ports." >&2
    exit 1
  fi
done

echo "Ports $FRONTEND_PORT and $BACKEND_PORT are available."
