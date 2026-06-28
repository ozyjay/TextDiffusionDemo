#!/usr/bin/env bash
set -euo pipefail

export FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
export FRONTEND_PORT="${FRONTEND_PORT:-3300}"
export BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
export BACKEND_PORT="${BACKEND_PORT:-8300}"

./scripts/kill_reserved_ports.sh
npm run dev
