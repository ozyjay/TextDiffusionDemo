#!/usr/bin/env bash
set -euo pipefail

export MODEL_ADAPTER_HOST="${MODEL_ADAPTER_HOST:-127.0.0.1}"
export MODEL_ADAPTER_PORT="${MODEL_ADAPTER_PORT:-8600}"
export DREAM_MODEL_PATH="${DREAM_MODEL_PATH:-Dream-org/Dream-v0-Instruct-7B}"

PYTHONPATH="adapters/dream_adapter${PYTHONPATH:+:$PYTHONPATH}" python3 -m dream_adapter.server
