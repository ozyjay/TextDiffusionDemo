#!/usr/bin/env bash
set -euo pipefail

export MODEL_ADAPTER_HOST="${MODEL_ADAPTER_HOST:-127.0.0.1}"
export MODEL_ADAPTER_PORT="${MODEL_ADAPTER_PORT:-8600}"
export DIFFUSIONGEMMA_MODEL="${DIFFUSIONGEMMA_MODEL:-mlx-community/diffusiongemma-26B-A4B-it-4bit}"

PYTHON="${DIFFUSIONGEMMA_PYTHON:-.venv-diffusiongemma/bin/python}"

if [[ ! -x "$PYTHON" ]]; then
  echo "DiffusionGemma Python runtime not found at $PYTHON" >&2
  echo "Create it with:" >&2
  echo "  python3 -m venv .venv-diffusiongemma" >&2
  echo "  .venv-diffusiongemma/bin/python -m pip install -U pip -r adapters/diffusiongemma_adapter/requirements.txt" >&2
  exit 1
fi

PYTHONPATH="adapters/diffusiongemma_adapter${PYTHONPATH:+:$PYTHONPATH}" "$PYTHON" -m diffusiongemma_adapter.server
