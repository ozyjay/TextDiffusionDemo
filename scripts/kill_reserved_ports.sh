#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-3300}"
BACKEND_PORT="${BACKEND_PORT:-8300}"

collect_pids() {
  {
    lsof -tiTCP:"$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null || true
    lsof -tiTCP:"$BACKEND_PORT" -sTCP:LISTEN 2>/dev/null || true
    pgrep -f "tsx watch server/index.ts" 2>/dev/null || true
    pgrep -f "vite --strictPort" 2>/dev/null || true
    pgrep -f "concurrently -k -n server,client" 2>/dev/null || true
  } | sort -u
}

stop_pids() {
  local signal="$1"
  local pids="$2"

  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping previous Text Diffusion Lab process(es) with $signal: $pids"
  kill "$signal" $pids
}

wait_for_ports() {
  local attempts=0
  while [[ "$attempts" -lt 20 ]]; do
    if ! lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN >/dev/null 2>&1 &&
      ! lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.25
  done
  return 1
}

for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
  if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is clear."
  fi
done

pids="$(collect_pids)"
stop_pids "-TERM" "$pids"

if ! wait_for_ports; then
  pids="$(collect_pids)"
  stop_pids "-KILL" "$pids"
  wait_for_ports
fi

./scripts/check_ports.sh
