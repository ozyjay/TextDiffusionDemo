#!/usr/bin/env bash
set -euo pipefail

export DEMO_NAME="text-diffusion-lab"
export DEMO_MODE="open-day"
export FRONTEND_HOST="127.0.0.1"
export FRONTEND_PORT="3300"
export BACKEND_HOST="127.0.0.1"
export BACKEND_PORT="8300"

./scripts/kill_reserved_ports.sh
npm run dev
